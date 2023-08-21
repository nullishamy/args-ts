import { Builtin, CoercionResult, Resolver, MinimalArgument } from '../../builder'
import { CoercionError, CommandError, InternalError } from '../../error'
import { StoredParserOpts } from '../../opts'
import { PrefixTree } from '../prefix-tree'
import { Err, Ok, Result } from '../result'
import { getArgDenotion } from '../util'
import { AnyParsedFlagArgument, DefaultCommand, ParsedArguments, ParsedLongArgument, ParsedPositionalArgument, ParsedRestArgument, ParsedShortArgumentSingle, UserCommand } from './parser'
import { CoercedValue, InternalArgument, InternalFlagArgument, InternalPositionalArgument } from './types'

export interface CoercedArguments {
  command: UserCommand | DefaultCommand | BuiltinCommand
  args: Map<InternalArgument, CoercedSingleValue | CoercedMultiValue>
  rest: ParsedRestArgument | undefined
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

export interface BuiltinCommand {
  type: 'builtin'
  command: Builtin
  trigger: string
}

function validateFlagSchematically (
  flags: Map<string, AnyParsedFlagArgument[]>,
  argument: InternalFlagArgument,
  opts: StoredParserOpts,
  resolveres: Resolver[]
): Result<AnyParsedFlagArgument[] | undefined, CoercionError> {
  let foundFlags = flags.get(argument.longFlag)
  if (argument.shortFlag && !foundFlags) {
    foundFlags = flags.get(argument.shortFlag)
  }

  let { specifiedDefault, unspecifiedDefault, optional, dependencies, conflicts, exclusive, requiredUnlessPresent } = argument.inner._meta

  // Test our resolvers to see if any of them have a value, so we know whether to reject below
  let resolversHaveValue = false

  for (const resolver of resolveres) {
    if (resolver.keyExists(argument.longFlag, opts)) {
      resolversHaveValue = true
    }
  }

  // Must be at the top, we modify `optional` behaviour
  for (const presentKey of requiredUnlessPresent) {
    const presence = flags.get(presentKey)
    if (presence !== undefined) {
      optional = true
    }
  }

  // If no definitions were provided
  if (!foundFlags?.length && !optional && unspecifiedDefault === undefined && !resolversHaveValue) {
    return Err(new CoercionError(argument.inner.type, '<nothing>', `argument '--${argument.longFlag}' is missing, with no unspecified default`, getArgDenotion(argument)))
  }

  for (const foundFlag of foundFlags ?? []) {
    // Groups will be checked for unrecognised flags later
    if (foundFlag && foundFlag.type === 'short-group') {
      return Ok(foundFlags)
    }

    // If no values were passed to a definition
    if (!optional && specifiedDefault === undefined && !foundFlag.values.length && !resolversHaveValue) {
      return Err(new CoercionError(argument.inner.type, '<nothing>', `argument '${argument.longFlag}' is not declared as optional, does not have a default, and was not provided a value`, getArgDenotion(argument)))
    }

    for (const dependency of dependencies) {
      const dependencyValue = flags.get(dependency)
      if (!dependencyValue) {
        return Err(new CoercionError('a value', '<nothing>', `unmet dependency '--${dependency}' for '--${argument.longFlag}'`, getArgDenotion(argument)))
      }
    }

    for (const conflict of conflicts) {
      const conflictValue = flags.get(conflict)
      // Require both the argument we're checking against (the base) and the conflict to exist
      if (conflictValue !== undefined && foundFlags?.length) {
        return Err(new CoercionError(`--${conflict} to not be passed`, conflictValue.map(c => c.rawInput).join(' '), `argument '--${conflict}' conflicts with '--${argument.longFlag}'`, getArgDenotion(argument)))
      }
    }

    if (exclusive && flags.size > 1) {
      return Err(new CoercionError('no other args to be passed', `${flags.size - 1} other arguments`, `argument '--${argument.longFlag}' is exclusive and cannot be used with other arguments`, getArgDenotion(argument)))
    }
  }

  return Ok(foundFlags)
}

function validatePositionalSchematically (
  positionals: Map<number, ParsedPositionalArgument>,
  argument: InternalPositionalArgument,
  opts: StoredParserOpts,
  middlewares: Resolver[]
): Result<ParsedPositionalArgument | undefined, CoercionError> {
  const foundFlag = positionals.get(argument.index)
  const { unspecifiedDefault, optional } = argument.inner._meta

  // Test our middlewares to see if any of them have a value, so we know whether to reject below
  let middlewaresHaveValue = false

  for (const middleware of middlewares) {
    if (middleware.keyExists(argument.key, opts)) {
      middlewaresHaveValue = true
    }
  }

  if (!optional && unspecifiedDefault === undefined && !foundFlag?.values && !middlewaresHaveValue) {
    return Err(new CoercionError(argument.inner.type, '<nothing>', `positional argument '${argument.key}' is not declared as optional, does not have a default, and was not provided a value`, argument.key))
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
        return new CoercionError(argument.inner.type, error.value, `could not parse a '${group.parser.type}' because ${error.error.message}`, getArgDenotion(argument))
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
      return new CoercionError(argument.inner.type, inputValues[0], `could not parse a '${error.parser.type}' because ${error.error.message}`, getArgDenotion(argument))
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

        const coercionResult = await parseSingle([value], argument)
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
          raw: `<default value for group member '${argument.shortFlag}' of '${userArgument.rawInput}'`,
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

function handleMultipleDefinitions (argument: InternalArgument, opts: StoredParserOpts): Result<'overwrite' | 'skip' | 'append', CoercionError> {
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

function handleDefinitionChecking (
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

function matchBuiltin (args: ParsedArguments, builtins: Builtin[]): undefined | [Builtin, string] {
  const { flags, command } = args

  const keysToSearch = new Set()
  // If a user command could not be resolved, attempt to find whatever value was there anyways
  // It is challenging to resolve builtins at parse time, so this enables us to delay it until coercion time
  if (command.type === 'default') {
    if (command.key) {
      keysToSearch.add(command.key)
    }
  } else {
    keysToSearch.add(command.internal.name)
    command.internal.aliases.forEach(alias => keysToSearch.add(alias))
  }

  for (const builtin of builtins) {
    const matchingFlag = builtin.argumentTriggers.find(flag => flags.has(flag))
    if (matchingFlag) {
      return [builtin, matchingFlag]
    }

    const matchingCommand = builtin.commandTriggers.find(cmd => keysToSearch.has(cmd))
    if (matchingCommand) {
      return [builtin, matchingCommand]
    }
  }

  return undefined
}

export async function coerce (
  args: ParsedArguments,
  opts: StoredParserOpts,
  internalArgs: PrefixTree<InternalArgument>,
  internalArgsList: InternalArgument[],
  resolvers: Resolver[],
  builtins: Builtin[]
): Promise<Result<CoercedArguments, CoercionError[] | CommandError>> {
  const out: Map<InternalArgument, CoercedSingleValue | CoercedMultiValue> = new Map()
  const { command, flags, positionals } = args

  // Before trying commands or further coercion, see if we match a builtin
  const builtinSearch = matchBuiltin(args, builtins)
  if (builtinSearch) {
    const [foundBuiltin, trigger] = builtinSearch
    return Ok({
      args: out,
      command: {
        type: 'builtin',
        command: foundBuiltin,
        trigger
      }
    })
  }

  // Validate the command to make sure we can run it
  if (command.type !== 'default') {
    const result = validateCommand(command, opts)
    if (!result.ok) {
      return result
    }
  }

  // Iterate the declarations, to weed out any missing arguments
  for (const argument of internalArgsList) {
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
        return Err([new CoercionError(argument.inner.type, inputValues.join(' '), `excess argument(s) to ${getArgDenotion(argument)}: ${pretty}`, getArgDenotion(argument))])
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
    rest: args.rest,
    args: out
  })
}
