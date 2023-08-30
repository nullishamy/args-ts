import { ArgsState } from '../../args'
import { Resolver, MinimalArgument } from '../../builder'
import { CoercionError, CommandError, InternalError } from '../../error'
import { StoredParserOpts } from '../../opts'
import { PrefixTree } from '../prefix-tree'
import { Err, Ok, Result } from '../result'
import { getArgDenotion } from '../util'
import { AnyParsedFlagArgument, ParsedArguments, ParsedLongArgument, ParsedPositionalArgument, ParsedShortArgumentSingle } from './parser'
import { validateCommandSchematically, validateFlagSchematically, validatePositionalSchematically, coerceMultiType } from './schematic-validation'
import { CoercedValue, InternalArgument } from './types'

export interface CoercedArguments {
  args: Map<InternalArgument, CoercedSingleValue | CoercedMultiValue>
  parsed: ParsedArguments
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

async function coerceSingleArgument (inputValue: string, argument: InternalArgument): Promise<Result<CoercedSingleValue, CoercionError[]>> {
  const parsers = [argument.inner, ...argument.inner._meta.otherParsers]
  const results = await Promise.all(parsers.map(async parser => [parser, await parser.coerce(inputValue)] as const))

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
      return new CoercionError(argument.inner.type, inputValue, `could not parse a '${error.parser.type}' because ${error.error.message}`, getArgDenotion(argument))
    }))
  }

  if (coerced === null) {
    throw new InternalError(`no coerced values set, but errors were not caught either? coerced: ${JSON.stringify(coerced)}, errors: ${JSON.stringify(errors)}`)
  }

  return Ok({
    isMulti: false,
    coerced,
    raw: inputValue
  })
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
  opts: StoredParserOpts,
  middlewares: Resolver[]
): Promise<Result<ResolvedDefault | ResolvedUser, CoercionError[]>> {
  // Only attempt middleware resolution if the user args are not set
  if (!userArguments) {
    const key = argument.type === 'flag' ? argument.longFlag : argument.key

    for (const middleware of middlewares) {
      if (middleware.keyExists(key, opts)) {
        const value = middleware.resolveKey(key, opts)

        if (!value) {
          continue
        }

        const coercionResult = await coerceSingleArgument(value, argument)
        if (!coercionResult.ok) {
          return coercionResult
        }

        return Ok({
          isDefault: true,
          value: {
            isMulti: false,
            raw: `<default value (from middleware '${middleware.identifier}') for ${getArgDenotion(argument)}>`,
            coerced: coercionResult.val.coerced
          }
        })
      }
    }
  }

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
          raw: `<default value for group member '${argument.longFlag}' of '${userArgument.rawInput}'`,
          coerced: argument.inner._meta.specifiedDefault
        }
      })
    }

    if (userArgument.negated) {
      argument.inner.negate()
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

function handleAdditionalArgumentDefinition (argument: InternalArgument, opts: StoredParserOpts): Result<'overwrite' | 'skip' | 'append', CoercionError> {
  const { arrayMultipleDefinitions, tooManyDefinitions } = opts
  if (argument.inner._meta.isMultiType) {
    if (arrayMultipleDefinitions === 'append') {
      return Ok('append')
    } else if (arrayMultipleDefinitions === 'throw') {
      return Err(new CoercionError('single definition', 'multiple definitions', `argument ${getArgDenotion(argument)}' is not permitted to have multiple definitions`, getArgDenotion(argument)))
    } else if (arrayMultipleDefinitions === 'drop') {
      return Ok('skip')
    } else if (arrayMultipleDefinitions === 'overwrite') {
      return Ok('overwrite')
    }
  } else {
    if (tooManyDefinitions === 'throw') {
      return Err(new CoercionError('single definition', 'multiple definitions', `argument ${getArgDenotion(argument)}' is not permitted to have multiple definitions`, getArgDenotion(argument)))
    } else if (tooManyDefinitions === 'drop') {
      return Ok('skip')
    } else if (tooManyDefinitions === 'overwrite') {
      return Ok('overwrite')
    }
  }

  throw new InternalError(`unhandled: array: ${arrayMultipleDefinitions} tooMany: ${tooManyDefinitions}`)
}

function handleUnmatchedArgument (
  definition: AnyParsedFlagArgument,
  internalArgs: PrefixTree<InternalArgument>,
  opts: StoredParserOpts
): Result<'break' | 'continue', CoercionError[]> {
  if (definition.type === 'short-group') {
    for (const flag of definition.flags) {
      const argument = internalArgs.findOrUndefined(flag)

      // If we do not find an argument to match the given value, follow config to figure out what to do for unknown arguments
      if (!argument) {
        const { unrecognisedArgument } = opts
        if (unrecognisedArgument === 'throw') {
          return Err([new CoercionError('<nothing>', definition.rawInput, `unrecognised flag '${flag}' in group '${definition.flags.join('')}'`, flag)])
        }

        // Otherwise, skip it
        continue
      }
    }

    return Ok('break')
  }

  const argument = internalArgs.findOrUndefined(definition.key)

  // If we do not find an argument to match the given value, follow config to figure out what to do for unknown arguments
  if (argument === undefined) {
    const { unrecognisedArgument } = opts
    if (unrecognisedArgument === 'throw') {
      return Err([new CoercionError('<nothing>', definition.rawInput, `unrecognised argument '${definition.rawInput}'`, definition.rawInput)])
    }

    // Otherwise, skip it
    return Ok('break')
  }

  return Ok('continue')
}

export async function coerce (
  args: ParsedArguments,
  opts: StoredParserOpts,
  state: ArgsState
): Promise<Result<CoercedArguments, CoercionError[] | CommandError>> {
  const out: Map<InternalArgument, CoercedSingleValue | CoercedMultiValue> = new Map()
  const { command, flags, positionals } = args
  const { argumentsList, resolvers, arguments: argumentsTree } = state

  // Before trying commands or further coercion, see if we match a builtin
  if (command.type === 'builtin') {
    return Ok({
      args: out,
      parsed: args
    })
  }

  // Validate the command to make sure we can run it
  if (command.type !== 'default') {
    const result = validateCommandSchematically(command, opts)
    if (!result.ok) {
      return result
    }
  }

  // Iterate the declarations, to weed out any missing arguments
  for (const argument of argumentsList) {
    // Validate 'schema-level' properties, such as optionality, depedencies, etc
    // Do NOT consider 'value-level' properties such as value correctness
    let findResult
    if (argument.type === 'flag') {
      findResult = validateFlagSchematically(flags, argument, opts, resolvers)
    } else {
      findResult = validatePositionalSchematically(positionals, argument, opts, resolvers)
    }

    if (!findResult.ok) {
      return Err([findResult.err])
    }

    const resolutionResult = await resolveArgumentDefault(findResult.val, argument, opts, resolvers)

    if (!resolutionResult.ok) { return resolutionResult }

    const defaultOrValue = resolutionResult.val
    if (defaultOrValue.isDefault) {
      out.set(argument, defaultOrValue.value)
      continue
    }

    let userArgument = defaultOrValue.value

    // Multiple definitions found, let's see what we should do with them
    if (Array.isArray(userArgument) && userArgument.length > 1) {
      const multipleBehaviourResult = handleAdditionalArgumentDefinition(argument, opts)
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
        return Err([new CoercionError(argument.inner.type, inputValues.join(' '), `excess argument(s) to ${getArgDenotion(argument)}: ${pretty}`, getArgDenotion(argument))])
      }

      inputValues = inputValues.slice(0, 1)
    }

    if (!inputValues.length) {
      throw new InternalError('no input values set, initial validation failed to reject empty arg values')
    }

    let coercionResult
    if (argument.inner._meta.isMultiType) {
      coercionResult = await coerceMultiType(inputValues, argument)
    } else {
      if (inputValues.length !== 1) {
        throw new InternalError(`input values length was > 1, got ${inputValues} (len: ${inputValues.length})`)
      }

      coercionResult = await coerceSingleArgument(inputValues[0], argument)
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
      const result = handleUnmatchedArgument(definition, argumentsTree, opts)
      if (!result.ok) {
        return result
      }

      if (result.val === 'break') {
        break
      }
    }
  }

  return Ok({
    parsed: args,
    args: out
  })
}
