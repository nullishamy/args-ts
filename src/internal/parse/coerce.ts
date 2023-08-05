import { CoercionError, InternalError } from '../../error'
import { ParserOpts } from '../../opts'
import { Err, Ok, Result } from '../result'
import { getArgDenotion } from '../util'
import { AnyParsedFlagArgument, DefaultCommand, ParsedArguments, ParsedPositionalArgument, UserCommand } from './parser'
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

function validateFlagSchematically (flags: Map<string, AnyParsedFlagArgument>, argument: InternalFlagArgument): Result<AnyParsedFlagArgument | undefined, CoercionError> {
  let foundFlag = flags.get(argument.longFlag)
  if (argument.shortFlag && !foundFlag) {
    foundFlag = flags.get(argument.shortFlag)
  }

  const specifiedDefault = argument.inner._specifiedDefault
  const unspecifiedDefault = argument.inner._unspecifiedDefault

  if (!foundFlag && !argument.inner._optional && unspecifiedDefault === undefined) {
    return Err(new CoercionError(`argument '--${argument.longFlag}' is missing`))
  }

  if (!argument.inner._optional && specifiedDefault === undefined && !foundFlag?.values.length) {
    return Err(new CoercionError(`argument '${argument.longFlag}' is not declared as optional, does not have a default, and was not provided a value`))
  }

  const dependencies = argument.inner._dependencies ?? []
  for (const dependency of dependencies) {
    const dependencyValue = flags.get(dependency)
    if (!dependencyValue) {
      return Err(new CoercionError(`unmet dependency '--${dependency}' for '--${argument.longFlag}'`))
    }
  }

  return Ok(foundFlag)
}

function validatePositionalSchematically (positionals: Map<number, ParsedPositionalArgument>, argument: InternalPositionalArgument): Result<ParsedPositionalArgument | undefined, CoercionError> {
  const foundFlag = positionals.get(argument.index)
  const defaultValue = argument.inner._specifiedDefault

  if (!foundFlag && !argument.inner._optional) {
    return Err(new CoercionError(`positional argument '<${argument.key}>' is missing`))
  }

  if (!argument.inner._optional && defaultValue === undefined && !foundFlag?.values) {
    return Err(new CoercionError(`positional argument '${argument.key}' is not declared as optional, does not have a default, and was not provided a value`))
  }

  return Ok(foundFlag)
}

async function parseMulti (inputValues: string[], argument: InternalArgument): Promise<Result<CoercedMultiValue, CoercionError>> {
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
    return Err(new CoercionError(`encountered ${errors.length} error(s) during coercion:
    ${errors.map(e => `error: \`${e.error.message}\` whilst parsing "${getArgDenotion(argument)} ${e.value}" (argument number ${e.index + 1})`).join('\n\n')}`))
  }

  // Will pass if nothing failed to parse, just sanity checking the error catching process above
  if (coerced.length !== inputValues.length) {
    return Err(new InternalError(`coerced values be the same length as the user provided values (input: ${inputValues.length}, coerced: ${coerced.length})`))
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
    return Err(new CoercionError(`encountered error: \`${result.error.message}\` when coercing "${getArgDenotion(argument)} ${inputValues[0]}"`))
  }

  return Ok({
    isMulti: false,
    coerced: result.returnedValue,
    raw: inputValues[0]
  })
}

export async function coerce (
  args: ParsedArguments,
  opts: ParserOpts,
  internalArgs: Record<string, InternalArgument>
): Promise<Result<CoercedArguments, CoercionError>> {
  const out: Map<InternalArgument, CoercedSingleValue | CoercedMultiValue> = new Map()
  const { command, flags, positionals } = args

  // Iterate the declarations, to weed out any missing arguments
  for (const argument of Object.values(internalArgs)) {
    // Validate 'schema-level' properties, such as optionality, depedencies, etc
    // Do NOT consider 'value-level' properties such as value correctness
    let findResult
    if (argument.type === 'flag') {
      findResult = validateFlagSchematically(flags, argument)
    } else {
      findResult = validatePositionalSchematically(positionals, argument)
    }

    if (!findResult.ok) { return findResult }

    let coercionResult: Result<CoercedSingleValue | CoercedMultiValue, CoercionError>
    let userArgument = findResult.val

    // If the user provided argument is undefined, or there was no value was passed, we will fallback to the default value
    // the schematic validation will verify this is an acceptable path (ie. the arg has a default, is not required, etc)
    if (!userArgument) {
      coercionResult = Ok({
        isMulti: false,
        raw: `<default value for ${getArgDenotion(argument)}`,
        coerced: argument.inner._unspecifiedDefault
      })
    } else if (userArgument.type !== 'positional' && !userArgument.values.length) {
      if (argument.type !== 'flag') {
        return Err(new InternalError(`argument.type !== flag, got ${argument.type}`))
      }

      coercionResult = Ok({
        isMulti: false,
        raw: `<default value for ${getArgDenotion(argument)}`,
        coerced: argument.inner._specifiedDefault
      })
    } else {
      // Weird branching logic because we need to assign `coercionResult` in every branch
      // but we dont want to duplicate the logic for user value parsing, so we will include this collation here
      if (userArgument.type === 'positional' && argument.inner._isMultiType) {
      // Collate all positionals together into this one
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
      if (!argument.inner._isMultiType && inputValues.length > 1) {
        // Throw if appropriate, slice off the other arguments if not (acts as a skip)
        const { excessArgBehaviour } = opts
        if (excessArgBehaviour === 'throw') {
          return Err(new CoercionError(`excess argument(s) to ${getArgDenotion(argument)} '${inputValues.slice(1).join(' ')}'`))
        }

        inputValues = inputValues.slice(0, 1)
      }

      if (!inputValues.length) {
        return Err(new InternalError('no input values set, initial validation failed to reject empty arg values'))
      }

      if (argument.inner._isMultiType) {
        coercionResult = await parseMulti(inputValues, argument)
      } else {
        coercionResult = await parseSingle(inputValues, argument)
      }
    }

    if (!coercionResult.ok) {
      return coercionResult
    }

    out.set(argument, coercionResult.val)
  }

  // Then, iterate the parsed values, to weed out excess arguments
  for (const value of flags.values()) {
    const argument = internalArgs[value.key]

    // If we do not find an argument to match the given value, follow config to figure out what to do for unknown arguments
    if (!argument) {
      const { unknownArgBehaviour } = opts
      if (unknownArgBehaviour === 'throw') {
        return Err(new CoercionError(`unexpected argument '${value.rawInput}'`))
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
