import { CoercionError, CommandError, InternalError } from '../../error'
import { StoredParserOpts } from '../../opts'
import { Err, Ok, Result } from '../result'
import { getArgDenotion } from '../util'
import { AnyParsedFlagArgument, DefaultCommand, ParsedArguments, ParsedLongArgument, ParsedPositionalArgument, ParsedShortArgumentSingle, UserCommand } from './parser'
import { CoercedValue, InternalArgument, InternalFlagArgument, InternalPositionalArgument } from './types'

export interface CoercedArguments {
  command: UserCommand | DefaultCommand
  args: Map<InternalArgument, CoercedSingleValue | CoercedMultiValue>
}

export interface CoercedMultiValue {
  isMulti: true

  raw: string[]
  coerced: CoercedValue[]
}

export interface CoercedSingleValue {
  isMulti: false

  raw: string
  coerced: CoercedValue
}

function validateFlagSchematically (flags: Map<string, AnyParsedFlagArgument>, argument: InternalFlagArgument, opts: StoredParserOpts): Result<AnyParsedFlagArgument | undefined, CoercionError> {
  let foundFlag = flags.get(argument.longFlag)
  if (argument.shortFlag && !foundFlag) {
    foundFlag = flags.get(argument.shortFlag)
  }

  let { specifiedDefault, unspecifiedDefault, optional, dependencies, conflicts, exclusive, requiredUnlessPresent } = argument.inner._meta
  const { environmentPrefix } = opts

  // We need to do env lookup here to determine if some sort of value exists, so that we can correctly compute optional behaviour for the arg
  let envHasValue: boolean
  if (environmentPrefix) {
    envHasValue = !!process.env[envKey(argument, environmentPrefix)]
  } else {
    envHasValue = false
  }

  // Must be at the top, we modify `optional` behaviour
  for (const presentKey of requiredUnlessPresent) {
    const presence = flags.get(presentKey)
    if (presence !== undefined) {
      optional = true
    }
  }

  if (foundFlag && foundFlag.type === 'short-group') {
    for (const flag of foundFlag.flags) {
      if (!flags.get(flag)) {
        return Err(new CoercionError(argument.inner.type, '<nothing>', `flag '${flag}' from group '-${foundFlag.flags.join()}' is unknown`))
      }
    }

    return Ok(foundFlag)
  }

  if (!foundFlag && !optional && unspecifiedDefault === undefined && !envHasValue) {
    return Err(new CoercionError(argument.inner.type, '<nothing>', `argument '--${argument.longFlag}' is missing, with no unspecified default`))
  }

  if (!optional && specifiedDefault === undefined && !foundFlag?.values.length && !envHasValue) {
    return Err(new CoercionError(argument.inner.type, '<nothing>', `argument '${argument.longFlag}' is not declared as optional, does not have a default, and was not provided a value`))
  }

  for (const dependency of dependencies) {
    const dependencyValue = flags.get(dependency)
    if (!dependencyValue) {
      return Err(new CoercionError('a value', '<nothing>', `unmet dependency '--${dependency}' for '--${argument.longFlag}'`))
    }
  }

  for (const conflict of conflicts) {
    const conflictValue = flags.get(conflict)
    // Require both the argument we're checking against (the base) and the conflict to exist
    if (conflictValue !== undefined && foundFlag !== undefined) {
      return Err(new CoercionError(`--${conflict} to not be passed`, conflictValue.rawInput, `argument '--${conflict}' conflicts with '--${argument.longFlag}'`))
    }
  }

  if (exclusive && flags.size > 1) {
    return Err(new CoercionError('no other args to be passed', `${flags.size - 1} other arguments`, `argument '--${argument.longFlag}' is exclusive and cannot be used with other arguments`))
  }

  return Ok(foundFlag)
}

function validatePositionalSchematically (positionals: Map<number, ParsedPositionalArgument>, argument: InternalPositionalArgument): Result<ParsedPositionalArgument | undefined, CoercionError> {
  const foundFlag = positionals.get(argument.index)
  const { specifiedDefault, optional } = argument.inner._meta

  if (!foundFlag && !optional) {
    return Err(new CoercionError(argument.inner.type, '<nothing>', `positional argument '<${argument.key}>' is missing`))
  }

  if (!optional && specifiedDefault === undefined && !foundFlag?.values) {
    return Err(new CoercionError(argument.inner.type, '<nothing>', `positional argument '${argument.key}' is not declared as optional, does not have a default, and was not provided a value`))
  }

  return Ok(foundFlag)
}

async function parseMulti (inputValues: string[], argument: InternalArgument): Promise<Result<CoercedMultiValue, CoercionError | CoercionError[]>> {
  const results = await Promise.all(inputValues.map(async raw => await argument.inner.coerce(raw)))
  const coerced = []
  const errors: Array<{ index: number, error: Error, value: string }> = []

  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    if (result.ok) {
      coerced.push(result.returnedValue)
    } else {
      errors.push({
        index: i,
        value: result.passedValue,
        error: result.error
      })
    }
  }

  if (errors.length) {
    return Err(errors.map(e => {
      return new CoercionError(argument.inner.type, e.value, e.error.message)
    }))
  }

  // Will pass if nothing failed to parse, just sanity checking the error catching process above
  if (coerced.length !== inputValues.length) {
    throw new InternalError(`coerced values be the same length as the user provided values (input: ${inputValues.length}, coerced: ${coerced.length})`)
  }

  return Ok({
    isMulti: true,
    coerced,
    raw: inputValues
  })
}

async function parseSingle (inputValues: string[], argument: InternalArgument): Promise<Result<CoercedSingleValue, CoercionError>> {
  const result = await argument.inner.coerce(inputValues[0])

  if (!result.ok) {
    return Err(new CoercionError(argument.inner.type, inputValues[0], result.error.message))
  }

  return Ok({
    isMulti: false,
    coerced: result.returnedValue,
    raw: inputValues[0]
  })
}

function validateCommand (command: UserCommand, opts: StoredParserOpts): Result<void, CommandError> {
  const { deprecated, deprecationMessage } = command.internal.inner.opts

  // Do not run deprecated commands
  if (deprecated && opts.deprecatedCommands === 'error') {
    return Err(new CommandError(deprecationMessage))
  } else if (deprecated && opts.deprecatedCommands === 'unknown-command') {
    return Err(new CommandError(`unknown command '${command.internal.name}'`))
  }

  return Ok(undefined)
}

function envKey (argument: InternalArgument, prefix: string): string {
  const key = (argument.type === 'flag' ? argument.longFlag : argument.key).toUpperCase()
  return `${prefix}_${key}`
}

interface ResolvedDefault {
  isDefault: true
  value: CoercedSingleValue | CoercedMultiValue
}

interface ResolvedUser {
  isDefault: false
  value: ParsedPositionalArgument | ParsedLongArgument | ParsedShortArgumentSingle
}

async function resolveArgumentDefault (
  userArgument: ParsedPositionalArgument | AnyParsedFlagArgument | undefined,
  argument: InternalArgument,
  opts: StoredParserOpts
): Promise<Result<ResolvedDefault | ResolvedUser, CoercionError>> {
  /**
   * Resolution priority
   * 1) User args (returned at the bottom, if the conditions for defaults are not met)
   * 2) Environment
   * 3) Config file (TODO)
   * 4) Argument defaults
   */
  const { environmentPrefix } = opts
  // Try environment
  if (environmentPrefix && !userArgument) {
    const envValue = process.env[envKey(argument, environmentPrefix)]
    if (envValue) {
      const coercionResult = await parseSingle([envValue], argument)
      if (!coercionResult.ok) {
        return coercionResult
      }

      return Ok({
        isDefault: true,
        value: {
          isMulti: false,
          raw: `<default value (env) for ${getArgDenotion(argument)}>`,
          coerced: coercionResult.val.coerced
        }
      })
    }
  }

  // Try config files
  // TODO

  // No user arg, must fallback to default
  if (!userArgument) {
    return Ok({
      isDefault: true,
      value: {
        isMulti: false,
        raw: `<default value for ${getArgDenotion(argument)}>`,
        coerced: argument.inner._meta.unspecifiedDefault
      }
    })
  }

  // Now fallback to argument defaults
  // Groups cant have values, use the defaults
  if (userArgument.type === 'short-group') {
    if (argument.type !== 'flag') {
      throw new InternalError(`argument.type !== flag, got ${argument.type}`)
    }

    return Ok({
      isDefault: true,
      value: {
        isMulti: false,
        raw: `<default value for group member '${argument.shortFlag}' of '${userArgument.rawInput}'`,
        coerced: argument.inner._meta.specifiedDefault
      }
    })
  }

  // No user specified args, fallback
  if (userArgument.type !== 'positional' && !userArgument.values.length) {
    if (argument.type !== 'flag') {
      throw new InternalError(`argument.type !== flag, got ${argument.type}`)
    }

    return Ok({
      isDefault: true,
      value: {
        isMulti: false,
        raw: `<default value for ${getArgDenotion(argument)}`,
        coerced: argument.inner._meta.specifiedDefault
      }
    })
  }

  return Ok({
    isDefault: false,
    value: userArgument
  })
}

export async function coerce (
  args: ParsedArguments,
  opts: StoredParserOpts,
  internalArgs: Record<string, InternalArgument>
): Promise<Result<CoercedArguments, CoercionError[] | CommandError>> {
  const out: Map<InternalArgument, CoercedSingleValue | CoercedMultiValue> = new Map()
  const { command, flags, positionals } = args

  // Validate the command to make sure we can run it
  if (!command.isDefault) {
    const result = validateCommand(command, opts)
    if (!result.ok) {
      return result
    }
  }

  // Iterate the declarations, to weed out any missing arguments
  for (const argument of Object.values(internalArgs)) {
    // Validate 'schema-level' properties, such as optionality, depedencies, etc
    // Do NOT consider 'value-level' properties such as value correctness
    let findResult
    if (argument.type === 'flag') {
      findResult = validateFlagSchematically(flags, argument, opts)
    } else {
      findResult = validatePositionalSchematically(positionals, argument)
    }

    if (!findResult.ok) { return Err([findResult.err]) }

    const resolutionResult = await resolveArgumentDefault(findResult.val, argument, opts)

    if (!resolutionResult.ok) { return resolutionResult }

    const defaultOrValue = resolutionResult.val
    if (defaultOrValue.isDefault) {
      out.set(argument, defaultOrValue.value)
      continue
    }

    let userArgument = defaultOrValue.value

    // Collate all positionals together into this one, if the positional is a multi-type
    if (userArgument.type === 'positional' && argument.inner._meta.isMultiType) {
      const positionalValues = [...positionals.values()].flatMap(p => p.values)
      userArgument = {
        type: 'positional',
        index: userArgument.index,
        values: positionalValues,
        rawInput: `<${positionalValues.join(' ')}>`
      }
    }

    // If the user did end up passing values (we didn't fall back to a default), run the coercion on them
    let inputValues = userArgument.values

    // User passed more than one argument, and this is not a multi type
    if (!argument.inner._meta.isMultiType && inputValues.length > 1) {
      // Throw if appropriate, slice off the other arguments if not (acts as a skip)
      const { tooManyArgs: excessArgBehaviour } = opts
      if (excessArgBehaviour === 'throw') {
        const pretty = inputValues.slice(1).map(s => `'${s}'`).join(', ')
        return Err([new CoercionError(argument.inner.type, inputValues.join(' '), `excess argument(s) to ${getArgDenotion(argument)}: ${pretty}`)])
      }

      inputValues = inputValues.slice(0, 1)
    }

    if (!inputValues.length) {
      throw new InternalError('no input values set, initial validation failed to reject empty arg values')
    }

    let coercionResult
    if (argument.inner._meta.isMultiType) {
      coercionResult = await parseMulti(inputValues, argument)
    } else {
      coercionResult = await parseSingle(inputValues, argument)
    }

    if (!coercionResult.ok) {
      if (Array.isArray(coercionResult.err)) {
        return Err(coercionResult.err)
      } else {
        return Err([coercionResult.err])
      }
    }

    out.set(argument, coercionResult.val)
  }

  // Then, iterate the parsed values, to weed out excess arguments
  for (const value of flags.values()) {
    if (value.type === 'short-group') {
      for (const flag of value.flags) {
        const argument = internalArgs[flag]

        // If we do not find an argument to match the given value, follow config to figure out what to do for unknown arguments
        if (!argument) {
          const { unrecognisedArgument: unknownArgBehaviour } = opts
          if (unknownArgBehaviour === 'throw') {
            return Err([new CoercionError('<nothing>', value.rawInput, `unexpected argument '${value.rawInput}'`)])
          }

          // Otherwise, skip it
          continue
        }
      }

      break
    }

    const argument = internalArgs[value.key]

    // If we do not find an argument to match the given value, follow config to figure out what to do for unknown arguments
    if (!argument) {
      const { unrecognisedArgument: unknownArgBehaviour } = opts
      if (unknownArgBehaviour === 'throw') {
        return Err([new CoercionError('<nothing>', value.rawInput, `unexpected argument '${value.rawInput}'`)])
      }

      // Otherwise, skip it
      continue
    }
  }

  return Ok({
    command,
    args: out
  })
}
