import { CoercionResult, MinimalArgument } from '../../builder'
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

function validateFlagSchematically (flags: Map<string, AnyParsedFlagArgument[]>, argument: InternalFlagArgument, opts: StoredParserOpts): Result<AnyParsedFlagArgument[] | undefined, CoercionError> {
  let foundFlags = flags.get(argument.longFlag)
  if (argument.shortFlag && !foundFlags) {
    foundFlags = flags.get(argument.shortFlag)
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

  // If no definitions were provided
  if (!foundFlags?.length && !optional && unspecifiedDefault === undefined && !envHasValue) {
    return Err(new CoercionError(argument.inner.type, '<nothing>', `argument '--${argument.longFlag}' is missing, with no unspecified default`))
  }

  for (const foundFlag of foundFlags ?? []) {
    // Groups will be checked for unrecognised flags later
    if (foundFlag && foundFlag.type === 'short-group') {
      return Ok(foundFlags)
    }

    // If no values were passed to a definition
    if (!optional && specifiedDefault === undefined && !foundFlag.values.length && !envHasValue) {
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
      if (conflictValue !== undefined && foundFlags?.length) {
        return Err(new CoercionError(`--${conflict} to not be passed`, conflictValue.map(c => c.rawInput).join(' '), `argument '--${conflict}' conflicts with '--${argument.longFlag}'`))
      }
    }

    if (exclusive && flags.size > 1) {
      return Err(new CoercionError('no other args to be passed', `${flags.size - 1} other arguments`, `argument '--${argument.longFlag}' is exclusive and cannot be used with other arguments`))
    }
  }

  return Ok(foundFlags)
}

function validatePositionalSchematically (positionals: Map<number, ParsedPositionalArgument>, argument: InternalPositionalArgument, opts: StoredParserOpts): Result<ParsedPositionalArgument | undefined, CoercionError> {
  const foundFlag = positionals.get(argument.index)
  const { unspecifiedDefault, optional } = argument.inner._meta

  const { environmentPrefix } = opts

  // We need to do env lookup here to determine if some sort of value exists, so that we can correctly compute optional behaviour for the arg
  let envHasValue: boolean
  if (environmentPrefix) {
    envHasValue = !!process.env[envKey(argument, environmentPrefix)]
  } else {
    envHasValue = false
  }

  if (!optional && unspecifiedDefault === undefined && !foundFlag?.values && !envHasValue) {
    return Err(new CoercionError(argument.inner.type, '<nothing>', `positional argument '${argument.key}' is not declared as optional, does not have a default, and was not provided a value`))
  }

  return Ok(foundFlag)
}

async function parseMulti (inputValues: string[], argument: InternalArgument): Promise<Result<CoercedMultiValue, CoercionError | CoercionError[]>> {
  const eachParserResults: Map<MinimalArgument<CoercedValue>, Array<CoercionResult<CoercedValue>>> = new Map()

  for (const value of inputValues) {
    for (const parser of [argument.inner, ...argument.inner._meta.otherParsers]) {
      const parsed = await parser.coerce(value)
      const alreadyParsed = eachParserResults.get(parser) ?? []

      alreadyParsed.push(parsed)
      eachParserResults.set(parser, alreadyParsed)
    }
  }

  interface SingleError {
    value: string
    error: Error
  }
  interface GroupedError {
    parser: MinimalArgument<unknown>
    errors: SingleError[]
  }

  interface CoercedGroup {
    parser: MinimalArgument<unknown>
    values: CoercedValue[]
  }

  const coercedGroups: CoercedGroup[] = []
  const groupedErrors: GroupedError[] = []

  for (const [parser, results] of eachParserResults.entries()) {
    const errors: SingleError[] = []
    const coerced = []

    for (const result of results) {
      if (result.ok) {
        coerced.push(result.returnedValue)
      } else {
        errors.push({
          value: result.passedValue,
          error: result.error
        })
      }
    }

    if (errors.length) {
      groupedErrors.push({
        parser,
        errors
      })
    } else {
      coercedGroups.push({
        parser,
        values: coerced
      })
    }
  }

  // If no parsers could resolve the values (no succesful groups)
  if (groupedErrors.length && !coercedGroups.length) {
    const errors = groupedErrors.flatMap(group => {
      return group.errors.map(error => {
        return new CoercionError(argument.inner.type, error.value, `parser '${group.parser.type}' failed: ${error.error.message}`)
      })
    })

    return Err(errors)
  }

  // Take the first group that managed to coerce all of the values
  const selectedGroup = coercedGroups.slice(0, 1)[0]
  if (!selectedGroup) {
    throw new InternalError(`no selected group, but errors were not caught either? coerced: ${JSON.stringify(coercedGroups)}, errors: ${JSON.stringify(groupedErrors)}`)
  }

  return Ok({
    isMulti: true,
    coerced: selectedGroup.values,
    raw: inputValues
  })
}

async function parseSingle (inputValues: string[], argument: InternalArgument): Promise<Result<CoercedSingleValue, CoercionError[]>> {
  const parsers = [argument.inner, ...argument.inner._meta.otherParsers]
  const results = await Promise.all(parsers.map(async parser => [parser, await parser.coerce(inputValues[0])] as const))

  const errors: Array<{
    error: Error
    parser: MinimalArgument<CoercedValue>
  }> = []
  let coerced: CoercedValue | null = null

  for (const [parser, result] of results) {
    if (result.ok) {
      // Only set once, we want to take the earliest value in the chain that passes
      if (coerced === null) {
        coerced = result.returnedValue
      }
    } else {
      errors.push({
        parser,
        error: result.error
      })
    }
  }

  if (errors.length && coerced === null) {
    return Err(errors.map(error => {
      return new CoercionError(argument.inner.type, inputValues[0], `parser '${error.parser.type}' failed: ${error.error.message}`)
    }))
  }

  if (coerced === null) {
    throw new InternalError(`no coerced values set, but errors were not caught either? coerced: ${JSON.stringify(coerced)}, errors: ${JSON.stringify(errors)}`)
  }

  return Ok({
    isMulti: false,
    coerced,
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
  value: ParsedPositionalArgument | ParsedLongArgument[] | ParsedShortArgumentSingle[]
}

async function resolveArgumentDefault (
  userArguments: ParsedPositionalArgument | AnyParsedFlagArgument[] | undefined,
  argument: InternalArgument,
  opts: StoredParserOpts
): Promise<Result<ResolvedDefault | ResolvedUser, CoercionError[]>> {
  /**
   * Resolution priority
   * 1) User args (returned at the bottom, if the conditions for defaults are not met)
   * 2) Environment
   * 3) Config file (TODO)
   * 4) Argument defaults
   */
  const { environmentPrefix } = opts
  // Try environment
  if (environmentPrefix && !userArguments) {
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
  if (!userArguments) {
    return Ok({
      isDefault: true,
      value: {
        isMulti: false,
        raw: `<default value for ${getArgDenotion(argument)}>`,
        coerced: argument.inner._meta.unspecifiedDefault
      }
    })
  }

  if (!Array.isArray(userArguments)) {
    return Ok({
      isDefault: false,
      value: userArguments
    })
  }

  // Now fallback to argument defaults
  // Groups cant have values, use the defaults
  for (const userArgument of userArguments) {
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
    if (!userArgument.values.length) {
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
  }

  return Ok({
    isDefault: false,
    // We filter in the loop above
    value: userArguments as ParsedLongArgument[] | ParsedShortArgumentSingle[]
  })
}

function handleMultipleDefinitions (argument: InternalArgument, opts: StoredParserOpts): Result<'overwrite' | 'skip' | 'append', CoercionError> {
  const { arrayMultipleDefinitions, tooManyDefinitions } = opts
  if (argument.inner._meta.isMultiType) {
    if (arrayMultipleDefinitions === 'append') {
      return Ok('append')
    } else if (arrayMultipleDefinitions === 'throw') {
      return Err(new CoercionError('single definition', 'multiple definitions', `argument ${getArgDenotion(argument)}' is not permitted to have multiple definitions`))
    } else if (arrayMultipleDefinitions === 'drop') {
      return Ok('skip')
    } else if (arrayMultipleDefinitions === 'overwrite') {
      return Ok('overwrite')
    }
  } else {
    if (tooManyDefinitions === 'throw') {
      return Err(new CoercionError('single definition', 'multiple definitions', `argument ${getArgDenotion(argument)}' is not permitted to have multiple definitions`))
    } else if (tooManyDefinitions === 'drop') {
      return Ok('skip')
    } else if (tooManyDefinitions === 'overwrite') {
      return Ok('overwrite')
    }
  }

  throw new InternalError(`unhandled: array: ${arrayMultipleDefinitions} tooMany: ${tooManyDefinitions}`)
}

function handleDefinitionChecking (
  definition: AnyParsedFlagArgument,
  internalArgs: Record<string, InternalArgument>,
  opts: StoredParserOpts
): Result<'break' | 'continue', CoercionError[]> {
  if (definition.type === 'short-group') {
    for (const flag of definition.flags) {
      const argument = internalArgs[flag]

      // If we do not find an argument to match the given value, follow config to figure out what to do for unknown arguments
      if (!argument) {
        const { unrecognisedArgument } = opts
        if (unrecognisedArgument === 'throw') {
          return Err([new CoercionError('<nothing>', definition.rawInput, `unrecognised flag '${flag}' in group '${definition.flags.join('')}'`)])
        }

        // Otherwise, skip it
        continue
      }
    }

    return Ok('break')
  }

  const argument = internalArgs[definition.key]

  // If we do not find an argument to match the given value, follow config to figure out what to do for unknown arguments
  if (argument === undefined) {
    const { unrecognisedArgument } = opts
    if (unrecognisedArgument === 'throw') {
      return Err([new CoercionError('<nothing>', definition.rawInput, `unrecognised argument '${definition.rawInput}'`)])
    }

    // Otherwise, skip it
    return Ok('break')
  }

  return Ok('continue')
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
      findResult = validatePositionalSchematically(positionals, argument, opts)
    }

    if (!findResult.ok) {
      return Err([findResult.err])
    }

    const resolutionResult = await resolveArgumentDefault(findResult.val, argument, opts)

    if (!resolutionResult.ok) { return resolutionResult }

    const defaultOrValue = resolutionResult.val
    if (defaultOrValue.isDefault) {
      out.set(argument, defaultOrValue.value)
      continue
    }

    let userArgument = defaultOrValue.value

    // Multiple definitions found, let's see what we should do with them
    if (Array.isArray(userArgument) && userArgument.length > 1) {
      const multipleBehaviourResult = handleMultipleDefinitions(argument, opts)
      if (!multipleBehaviourResult.ok) {
        return multipleBehaviourResult
      }

      if (multipleBehaviourResult.val === 'overwrite') {
        // Only take the last definition
        userArgument = userArgument.slice(-1)
      } else if (multipleBehaviourResult.val === 'skip') {
        // Only take the first definition
        userArgument = userArgument.slice(0, 1)
      }
      // Otherwise, 'append', take them all
    }

    // Collate all positionals together into this one, if the positional is a multi-type
    if (!Array.isArray(userArgument) && argument.inner._meta.isMultiType) {
      const positionalValues = [...positionals.values()].flatMap(p => p.values)
      userArgument = {
        type: 'positional',
        index: userArgument.index,
        values: positionalValues,
        rawInput: `<${positionalValues.join(' ')}>`
      }
    }

    // If the user did end up passing values (we didn't fall back to a default), run the coercion on them
    let inputValues

    if (Array.isArray(userArgument)) {
      inputValues = userArgument.flatMap(u => u.values)
    } else {
      inputValues = userArgument.values
    }

    // User passed more than one argument, and this is not a multi type
    if (!argument.inner._meta.isMultiType && inputValues.length > 1) {
      // Throw if appropriate, slice off the other arguments if not (acts as a skip)
      const { tooManyArgs } = opts
      if (tooManyArgs === 'throw') {
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
  for (const definitions of flags.values()) {
    for (const definition of definitions) {
      const result = handleDefinitionChecking(definition, internalArgs, opts)
      if (!result.ok) {
        return result
      }

      if (result.val === 'break') {
        break
      }
    }
  }

  return Ok({
    command,
    args: out
  })
}
