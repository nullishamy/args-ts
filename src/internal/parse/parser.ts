import { Command } from '../../builder'
import { CoercionError, InternalError, ParseError } from '../../error'
import { ParserOpts } from '../../opts'
import { Err, Ok, Result } from '../result'
import { getArgDenotion } from '../util'
import { IdentToken, TokenIterator, ValueToken } from './lexer'
import { CoercedValue, InternalArgument, InternalCommand, InternalFlagArgument, InternalPositionalArgument } from './types'

export interface SingleParsedValue {
  isMulti: false

  raw: string
  coerced: CoercedValue
}

export interface MultiParsedValue {
  isMulti: true

  raw: string[]
  coerced: CoercedValue[]
}

export interface ParsedCommand {
  isDefault: false
  command: Command

  arguments: Map<InternalArgument, SingleParsedValue | MultiParsedValue>
}

export interface DefaultCommand {
  isDefault: true

  arguments: Map<InternalArgument, SingleParsedValue | MultiParsedValue>
}

interface ParsedFlag {
  type: 'flag'
  ident: IdentToken
  values: ValueToken[]
}
interface ParsedPositional {
  type: 'positional'
  index: number
  values: ValueToken[]
}

interface CommandExtraction {
  object: ParsedCommand | DefaultCommand
  internal: InternalCommand | undefined
}

function extractCommandObject (tokens: TokenIterator, commands: Record<string, InternalCommand>): CommandExtraction {
  const maybeRootCommand = tokens.current()
  let commandObject: ParsedCommand | DefaultCommand
  let internalCommand

  if (maybeRootCommand?.type === 'value') {
    const subcommandKeys = []
    const rootCommandName = maybeRootCommand.userValue

    internalCommand = commands[rootCommandName]

    if (!internalCommand) {
      commandObject = {
        isDefault: true,
        arguments: new Map()
      }

      return {
        object: commandObject,
        internal: internalCommand
      }
    }

    let currentToken = tokens.next()
    let currentCommand = internalCommand
    while (currentToken && currentToken.type === 'value') {
      if (!currentCommand.inner._subcommands[currentToken.userValue]) {
        break
      }

      subcommandKeys.push(currentToken.userValue)
      currentCommand = currentCommand.inner._subcommands[currentToken.userValue]
      internalCommand = currentCommand

      currentToken = tokens.next()
    }

    commandObject = {
      isDefault: false,
      arguments: new Map(),
      command: currentCommand.inner
    }
  } else {
    commandObject = {
      isDefault: true,
      arguments: new Map()
    }
  }

  return {
    object: commandObject,
    internal: internalCommand
  }
}

function extractValues (tokens: TokenIterator): Result<[ParsedFlag[], ParsedPositional[]], ParseError> {
  const positionals: ParsedPositional[] = []
  const flags: ParsedFlag[] = []

  // First, pull out all positional arguments
  let idx = 0
  for (let current = tokens.current(); current?.type === 'value'; current = tokens.next()) {
    positionals.push({
      type: 'positional',
      index: idx,
      values: [current] // Will be collected into a single later on, once we have multi type metadata available
    })
    idx++
  }

  // Then, pull out all flags
  while (tokens.hasMoreTokens()) {
    while (tokens.peek()?.type === 'flag-denotion') {
      tokens.next()
    }

    // Parse out the ident & the associated values
    const ident = tokens.next()

    if (!ident || ident.type !== 'ident') {
      return Err(new ParseError(`expected ident, got ${JSON.stringify(ident)}`))
    }

    // Gather all the user provided values
    const valueTokens: ValueToken[] = []

    let currentValue = tokens.peek()
    while (currentValue?.type === 'value') {
      // Skip the current token, and peek toward the next
      tokens.next()
      valueTokens.push(currentValue)
      currentValue = tokens.peek()
    }

    flags.push({
      type: 'flag',
      ident,
      values: valueTokens
    })
  }

  return Ok([flags, positionals])
}

function initiallyValidateFlag (flags: ParsedFlag[], argument: InternalFlagArgument): Result<ParsedFlag | undefined, ParseError | CoercionError> {
  const foundFlag = flags.find(v => v.ident?.lexeme === argument.longFlag || v.ident?.lexeme === argument.shortFlag)

  const specifiedDefault = argument.inner._specifiedDefault
  const unspecifiedDefault = argument.inner._unspecifiedDefault

  if (!foundFlag && !argument.inner._optional && unspecifiedDefault === undefined) {
    return Err(new ParseError(`argument '--${argument.longFlag}' is missing`))
  }

  if (!argument.inner._optional && specifiedDefault === undefined && !foundFlag?.values.length) {
    return Err(new CoercionError(`argument '${argument.longFlag}' is not declared as optional, does not have a default, and was not provided a value`))
  }

  const dependencies = argument.inner._dependencies ?? []
  for (const dependency of dependencies) {
    const dependencyValue = flags.find(v => v.ident?.lexeme === dependency)
    if (!dependencyValue) {
      return Err(new CoercionError(`unmet dependency '--${dependency}' for '--${argument.longFlag}'`))
    }
  }

  return Ok(foundFlag)
}

function initiallyValidatePositional (positionals: ParsedPositional[], argument: InternalPositionalArgument): Result<ParsedPositional | undefined, ParseError | CoercionError> {
  const foundFlag = positionals.find(v => v.index === argument.index)
  const defaultValue = argument.inner._specifiedDefault

  if (!foundFlag && !argument.inner._optional) {
    return Err(new ParseError(`positional argument '<${argument.key}>' is missing`))
  }

  if (!argument.inner._optional && defaultValue === undefined && !foundFlag?.values) {
    return Err(new CoercionError(`positional argument '${argument.key}' is not declared as optional, does not have a default, and was not provided a value`))
  }

  return Ok(foundFlag)
}

async function parseMulti (inputValues: string[], argument: InternalArgument): Promise<Result<MultiParsedValue, CoercionError>> {
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

async function parseSingle (inputValues: string[], argument: InternalArgument): Promise<Result<SingleParsedValue, CoercionError>> {
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

export async function parseAndCoerce (
  tokens: TokenIterator,
  opts: ParserOpts,
  commands: Record<string, InternalCommand>,
  internalArguments: Record<string, InternalArgument>
): Promise<Result<ParsedCommand | DefaultCommand, CoercionError | ParseError>> {
  // First take the commands / subcommands
  const { object: commandObject, internal } = extractCommandObject(tokens, commands)

  if (!commandObject.isDefault) {
    if (!internal) {
      return Err(new InternalError('no internal command provided for non-default command'))
    }

    // Set our context to the state of the command/subcommand parser
    commands = internal.parser.commands
    internalArguments = internal.parser.arguments
    opts = internal.parser.opts
  }

  // Next, parse out the arguments in their pairs
  const pairResult = extractValues(tokens)
  if (!pairResult.ok) { return pairResult }

  const [flags, positionals] = pairResult.val

  // Next, coerce and validate all the arguments
  // Iterate the declarations, to weed out any missing arguments
  for (const argument of Object.values(internalArguments)) {
    // Validate 'schema-level' properties, such as optionality, depedencies, etc
    // Do NOT consider 'value-level' properties such as value correctness
    let findResult
    if (argument.type === 'flag') {
      findResult = initiallyValidateFlag(flags, argument)
    } else {
      findResult = initiallyValidatePositional(positionals, argument)
    }

    if (!findResult.ok) { return findResult }

    let parsedValues: Result<SingleParsedValue | MultiParsedValue, CoercionError | ParseError>
    let foundArgument = findResult.val

    // If the pair is undefined, or there was no value was passed, we will fallback to the default value
    // the initial validation will verify this is an acceptable path (ie. the arg has a default, is not required, etc)
    if (!foundArgument) {
      parsedValues = Ok({
        isMulti: false,
        raw: `<default value for ${getArgDenotion(argument)}`,
        coerced: argument.inner._unspecifiedDefault
      })
    } else if (foundArgument.type === 'flag' && !foundArgument.values.length) {
      if (argument.type !== 'flag') {
        return Err(new InternalError(`argument.type !== flag, got ${argument.type}`))
      }

      parsedValues = Ok({
        isMulti: false,
        raw: `<default value for ${getArgDenotion(argument)}`,
        coerced: argument.inner._specifiedDefault
      })
    } else {
      if (foundArgument.type === 'positional' && argument.inner._isMultiType) {
        // Collate all positionals together into this one
        foundArgument = {
          type: 'positional',
          index: foundArgument.index,
          values: positionals.flatMap(p => p.values)
        }
      }
      // Otherwise, parse all values
      let inputValues = foundArgument.values.map(v => v.userValue)

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
        parsedValues = await parseMulti(inputValues, argument)
      } else {
        parsedValues = await parseSingle(inputValues, argument)
      }
    }

    if (!parsedValues.ok) { return parsedValues }

    commandObject.arguments.set(argument, parsedValues.val)
  }

  // Then, iterate the parsed values, to weed out excess arguments
  for (const value of flags) {
    const argument = internalArguments[value.ident.lexeme ?? '']

    // If we do not find an argument to match the given value, follow config to figure out what to do for unknown arguments
    if (!argument) {
      const { unknownArgBehaviour } = opts
      if (unknownArgBehaviour === 'throw') {
        return Err(new CoercionError(`unexpected argument '--${value.ident.lexeme}'`))
      }

      // Otherwise, skip it
      continue
    }
  }

  // Now, return the finished command object
  return Ok(commandObject)
}
