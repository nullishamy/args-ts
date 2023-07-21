import assert from 'assert'
import { Command } from '../../builder'
import { CoercionError, ParseError } from '../../error'
import { ParserOpts } from '../../opts'
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

function extractCommandObject (tokens: TokenIterator, commands: Record<string, InternalCommand>): [ParsedCommand | DefaultCommand, InternalCommand | undefined] {
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
      // TODO: Should this be configurable?
      throw new ParseError(`unknown command root ${rootCommandName}`)
    }

    let currentCommand = internalCommand
    for (let i = 0; i < subcommandKeys.length; i++) {
      const subcommand = subcommandKeys[i]

      if (!currentCommand.inner._subcommands[subcommand]) {
      // TODO: Should this be configurable?
        throw new ParseError(`could not find subcommand with path ${rootCommandName}/${subcommandKeys.slice(i).join('/')}`)
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

  return [commandObject, internalCommand]
}

export async function parseAndCoerce (
  tokens: TokenIterator,
  opts: ParserOpts,
  commands: Record<string, InternalCommand>,
  internalArguments: Record<string, InternalArgument>
): Promise<ParsedCommand | DefaultCommand> {
  // First take the commands / subcommands
  const [commandObject, maybeInternalCommand] = extractCommandObject(tokens, commands)

  if (!commandObject.isDefault) {
    assert(!!maybeInternalCommand)

    // Set our context to the state of the command/subcommand parser
    commands = maybeInternalCommand.parser.commands
    internalArguments = maybeInternalCommand.parser.arguments
    opts = maybeInternalCommand.parser.opts
  }

  // Next, parse out the arguments in their pairs
  const extractedPairs: ParsedPair[] = []
  while (tokens.hasMoreTokens()) {
    while (tokens.peek()?.type === 'flag-denotion') {
      tokens.next()
    }

    // Parse out the ident & the associated values
    // We must peek because
    const ident = tokens.next()

    if (!ident || ident.type !== 'ident') {
      throw new ParseError(`expected ident, got ${JSON.stringify(ident)}`)
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

  // Next, coerce and validate all the arguments
  // Iterate the declarations, to weed out any missing arguments
  for (const argument of Object.values(internalArguments)) {
    const extractedPair = extractedPairs.find(v => v.ident.lexeme === argument.longFlag || v.ident.lexeme === argument.shortFlag)

    // The token does not exist, or the value within the token does not exist ('--value <empty>' cases)
    const defaultValue = argument.inner._default

    if (!extractedPair && !argument.inner._optional) {
      throw new ParseError(`argument '--${argument.longFlag}' is missing`)
    }

    if (!argument.inner._optional && defaultValue === undefined && !extractedPair?.values.length) {
      throw new CoercionError(`argument '${argument.longFlag}' is not declared as optional, does not have a default, and was not provided a value`)
    }

    const dependencies = argument.inner._dependencies ?? []
    for (const dependency of dependencies) {
      const dependencyValue = extractedPairs.find(v => v.ident.lexeme === dependency)
      if (!dependencyValue) {
        throw new CoercionError(`unmet dependency '--${dependency}' for '--${argument.longFlag}'`)
      }
    }

    let parsedValues: SingleParsedValue | MultiParsedValue
    let inputValues = extractedPair?.values?.map(v => v.userValue) ?? []

    // If the user passes any values, parse them all
    if (inputValues.length) {
      // User passed more than one argument, and this is not a multi type
      if (!argument.inner._isMultiType && inputValues.length > 1) {
        // Throw if appropriate, slice off the other arguments if not
        const { excessArgBehaviour } = opts
        if (excessArgBehaviour === 'throw') {
          throw new CoercionError(`excess argument(s) to --${argument.longFlag} '${inputValues.slice(1).join(' ')}'`)
        }

        inputValues = inputValues.slice(0, 1)
      }

      if (argument.inner._isMultiType) {
        const results = await Promise.all(inputValues.map(async raw => await argument.inner.parse(raw)))
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
          throw new CoercionError(`encountered ${errors.length} error(s) during coercion:\n\n${errors.map(e => `error: \`${e.error.message}\` whilst parsing "--${argument.longFlag} ${e.value}" (argument number ${e.index + 1})`).join('\n\n')}`)
        }

        // True if nothing failed to parse/push
        assert(coerced.length === inputValues.length, 'coerced values be the same length as the user provided values')
        parsedValues = {
          isMulti: true,
          coerced,
          raw: inputValues
        }
      } else {
        const result = await argument.inner.parse(inputValues[0])
        if (!result.ok) {
          throw new CoercionError(`encountered error: \`${result.error.message}\` when coercing "--${argument.longFlag} ${inputValues[0]}"`)
        }

        parsedValues = {
          isMulti: false,
          coerced: result.returnedValue,
          raw: inputValues[0]
        }
      }
    } else {
      parsedValues = {
        isMulti: false,
        raw: `<default value for --${argument.longFlag}>`,
        coerced: defaultValue
      }
    }

    commandObject.arguments.set(argument, parsedValues)
  }

  // Then, iterate the parsed values, to weed out excess arguments
  for (const value of extractedPairs) {
    const declaration = internalArguments[value.ident.lexeme]
    // If we do not find a declaration, follow config to figure out what to do for excess arguments
    if (!declaration) {
      const { unknownArgBehaviour } = opts
      if (unknownArgBehaviour === 'throw') {
        throw new CoercionError(`unexpected argument '--${value.ident.lexeme}'`)
      }

      // Otherwise, skip it
      continue
    }
  }

  // Now, return the finished command object
  return commandObject
}
