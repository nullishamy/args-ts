import { Resolver, MinimalArgument, CoercionResult } from '../../builder'
import { CommandError, CoercionError, InternalError } from '../../error'
import { StoredParserOpts } from '../../opts'
import { Result, Err, Ok } from '../result'
import { getArgDenotion } from '../util'
import { CoercedMultiValue } from './coerce'
import { UserCommand, AnyParsedFlagArgument, ParsedPositionalArgument } from './parser'
import { InternalFlagArgument, InternalPositionalArgument, InternalArgument, CoercedValue } from './types'

export function validateCommandSchematically (command: UserCommand, opts: StoredParserOpts): Result<void, CommandError> {
  const { deprecated, deprecationMessage } = command.internal.inner.opts

  // Do not run deprecated commands
  if (deprecated && opts.deprecatedCommands === 'error') {
    return Err(new CommandError(deprecationMessage))
  } else if (deprecated && opts.deprecatedCommands === 'unknown-command') {
    return Err(new CommandError(`unknown command '${command.internal.name}'`))
  }

  return Ok(undefined)
}

export async function validateFlagSchematically (
  flags: Map<string, AnyParsedFlagArgument[]>,
  argument: InternalFlagArgument,
  opts: StoredParserOpts,
  resolvers: Resolver[]
): Promise<Result<AnyParsedFlagArgument[] | undefined, CoercionError>> {
  let foundFlags = flags.get(argument.longFlag)
  if (argument.aliases.length && !foundFlags) {
    for (const alias of argument.aliases) {
      foundFlags = flags.get(alias.value)

      if (foundFlags) {
        break
      }
    }
  }

  const userDidProvideArgs = (foundFlags ?? []).length > 0

  let { resolveDefault, optional, dependencies, conflicts, exclusive, requiredUnlessPresent } = argument.inner._state
  const [specifiedDefault, unspecifiedDefault] = await Promise.all([resolveDefault('specified'), resolveDefault('unspecified')])

  // Test our resolvers to see if any of them have a value, so we know whether to reject below
  let resolversHaveValue = false

  for (const resolver of resolvers) {
    if (await resolver.keyExists(argument.longFlag, userDidProvideArgs, opts)) {
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

export async function validatePositionalSchematically (
  positionals: Map<number, ParsedPositionalArgument>,
  argument: InternalPositionalArgument,
  opts: StoredParserOpts,
  resolvers: Resolver[]
): Promise<Result<ParsedPositionalArgument | undefined, CoercionError>> {
  const foundFlag = positionals.get(argument.index)
  const { resolveDefault, optional } = argument.inner._state
  const unspecifiedDefault = await resolveDefault('unspecified')

  // Test our resolvers to see if any of them have a value, so we know whether to reject below
  let resolversHaveValue = false

  for (const middleware of resolvers) {
    if (await middleware.keyExists(argument.key, foundFlag !== undefined, opts)) {
      resolversHaveValue = true
    }
  }

  if (!optional && unspecifiedDefault === undefined && !foundFlag?.values && !resolversHaveValue) {
    return Err(new CoercionError(argument.inner.type, '<nothing>', `positional argument '${argument.key}' is not declared as optional, does not have a default, and was not provided a value`, argument.key))
  }

  return Ok(foundFlag)
}

export async function coerceMultiType (inputValues: string[], argument: InternalArgument): Promise<Result<CoercedMultiValue, CoercionError | CoercionError[]>> {
  const eachParserResults: Map<MinimalArgument<CoercedValue>, Array<CoercionResult<CoercedValue>>> = new Map()

  for (const value of inputValues) {
    for (const parser of [argument.inner, ...argument.inner._state.otherParsers]) {
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
