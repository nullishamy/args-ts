import { Command } from '../../builder'
import { CoercionError, InternalError, ParseError } from '../../error'
import { ParserOpts } from '../../opts'
import { Err, Ok, Result } from '../result'
import { IdentToken, TokenIterator, ValueToken } from './lexer'
import { CoercedValue, InternalArgument, InternalCommand } from './types'

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

interface ParsedPair {
  ident: IdentToken
  values: ValueToken[]
}

interface CommandExtraction {
  object: ParsedCommand | DefaultCommand
  internal: InternalCommand | undefined
}

function extractCommandObject (tokens: TokenIterator, commands: Record<string, InternalCommand>): Result<CommandExtraction, ParseError> {
  const maybeRootCommand = tokens.current()
  let commandObject: ParsedCommand | DefaultCommand
  let internalCommand

  if (maybeRootCommand?.type === 'value') {
    const subcommandKeys = []
    const rootCommandName = maybeRootCommand.userValue

    let current = tokens.peek()
    while (current && current.type === 'value') {
      tokens.next()
      subcommandKeys.push(current.userValue)
      current = tokens.peek()
    }

    internalCommand = commands[rootCommandName]

    if (!internalCommand) {
      return Err(new ParseError(`unknown command root ${rootCommandName}`))
    }

    let currentCommand = internalCommand
    for (let i = 0; i < subcommandKeys.length; i++) {
      const subcommand = subcommandKeys[i]

      if (!currentCommand.inner._subcommands[subcommand]) {
        return Err(new ParseError(`could not find subcommand with path ${rootCommandName}/${subcommandKeys.slice(i).join('/')}`))
      }

      currentCommand = currentCommand.inner._subcommands[subcommand]
      internalCommand = currentCommand
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

  return Ok({
    object: commandObject,
    internal: internalCommand
  })
}

function extractPairs (tokens: TokenIterator): Result<ParsedPair[], ParseError> {
  const extractedPairs: ParsedPair[] = []
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

    extractedPairs.push({
      ident,
      values: valueTokens
    })
  }

  return Ok(extractedPairs)
}

function performInitialValidation (extractedPairs: ParsedPair[], argument: InternalArgument): Result<ParsedPair | undefined, ParseError | CoercionError> {
  const extractedPair = extractedPairs.find(v => v.ident.lexeme === argument.longFlag || v.ident.lexeme === argument.shortFlag)

  // The token does not exist, or the value within the token does not exist ('--value <empty>' cases)
  const defaultValue = argument.inner._default

  if (!extractedPair && !argument.inner._optional) {
    return Err(new ParseError(`argument '--${argument.longFlag}' is missing`))
  }

  if (!argument.inner._optional && defaultValue === undefined && !extractedPair?.values.length) {
    return Err(new CoercionError(`argument '${argument.longFlag}' is not declared as optional, does not have a default, and was not provided a value`))
  }

  const dependencies = argument.inner._dependencies ?? []
  for (const dependency of dependencies) {
    const dependencyValue = extractedPairs.find(v => v.ident.lexeme === dependency)
    if (!dependencyValue) {
      return Err(new CoercionError(`unmet dependency '--${dependency}' for '--${argument.longFlag}'`))
    }
  }

  return Ok(extractedPair)
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
    return Err(new CoercionError(`encountered ${errors.length} error(s) during coercion:\n\n${errors.map(e => `error: \`${e.error.message}\` whilst parsing "--${argument.longFlag} ${e.value}" (argument number ${e.index + 1})`).join('\n\n')}`))
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
    return Err(new CoercionError(`encountered error: \`${result.error.message}\` when coercing "--${argument.longFlag} ${inputValues[0]}"`))
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
  const extractionResult = extractCommandObject(tokens, commands)
  if (!extractionResult.ok) { return extractionResult }

  const { object: commandObject, internal: maybeInternalCommand } = extractionResult.val

  if (!commandObject.isDefault) {
    if (!maybeInternalCommand) {
      return Err(new InternalError('no internal command provided for non-default command'))
    }

    // Set our context to the state of the command/subcommand parser
    commands = maybeInternalCommand.parser.commands
    internalArguments = maybeInternalCommand.parser.arguments
    opts = maybeInternalCommand.parser.opts
  }

  // Next, parse out the arguments in their pairs
  const pairResult = extractPairs(tokens)
  if (!pairResult.ok) { return pairResult }

  const extractedPairs = pairResult.val

  // Next, coerce and validate all the arguments
  // Iterate the declarations, to weed out any missing arguments
  for (const argument of Object.values(internalArguments)) {
    const defaultValue = argument.inner._default

    // Validate 'schema-level' properties, such as optionality, depedencies, etc
    // Do NOT consider 'value-level' properties such as value correctness
    const pairResult = performInitialValidation(extractedPairs, argument)
    if (!pairResult.ok) { return pairResult }

    let parsedValues: Result<SingleParsedValue | MultiParsedValue, CoercionError | ParseError>

    const extractedPair = pairResult.val
    if (!extractedPair || !extractedPair.values.length) {
      // If the pair is undefined, or there was no value passed, we will fallback to the default value
      // performInitialValidation will verify this is an acceptable path (ie. the arg has a default, is not required, etc)
      parsedValues = Ok({
        isMulti: false,
        raw: `<default value for --${argument.longFlag}>`,
        coerced: defaultValue
      })
    } else {
      // Otherwise, parse all values
      let inputValues = extractedPair.values.map(v => v.userValue)

      // User passed more than one argument, and this is not a multi type
      if (!argument.inner._isMultiType && inputValues.length > 1) {
        // Throw if appropriate, slice off the other arguments if not (acts as a skip)
        const { excessArgBehaviour } = opts
        if (excessArgBehaviour === 'throw') {
          return Err(new CoercionError(`excess argument(s) to --${argument.longFlag} '${inputValues.slice(1).join(' ')}'`))
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
  for (const value of extractedPairs) {
    const argument = internalArguments[value.ident.lexeme]

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
