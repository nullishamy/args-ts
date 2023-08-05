import { ParseError } from '../../error'
import { ParserOpts } from '../../opts'
import { Err, Ok, Result } from '../result'
import { TokenIterator } from './lexer'
import { InternalCommand } from './types'

interface ParsedArgumentBase {
  rawInput: string
}

// --flag value
export interface ParsedLongArgument extends ParsedArgumentBase {
  type: 'long'
  key: string
  values: string[]
}

// -fvf
export interface ParsedShortArgumentGroup extends ParsedArgumentBase {
  type: 'short-group'
  flags: string[]
}

// -f test
export interface ParsedShortArugmentSingle extends ParsedArgumentBase {
  type: 'short-single'
  key: string
  values: string[]
}

// <value>
export interface ParsedPositionalArgument extends ParsedArgumentBase {
  type: 'positional'
  index: number
  values: string[]
}

export type AnyParsedArgument = ParsedLongArgument | ParsedShortArgumentGroup | ParsedShortArugmentSingle | ParsedPositionalArgument
export type AnyParsedFlagArgument = ParsedLongArgument | ParsedShortArugmentSingle

export interface UserCommand {
  isDefault: false
  keyParts: string[]
  internal: InternalCommand
}

export interface DefaultCommand {
  isDefault: true
}

export interface ParsedArguments {
  command: UserCommand | DefaultCommand
  flags: Map<string, AnyParsedFlagArgument>
  positionals: Map<number, ParsedPositionalArgument>
}

function parseUnquoted (tokens: TokenIterator, whitespace: boolean): Result<string, ParseError> {
  if (whitespace) {
    consumeWhitespace(tokens)
  }
  const current = tokens.current()
  if (!current) {
    return Err(new ParseError('no more tokens when trying to parse unquoted value'))
  }

  let out = ''
  if (current?.type === 'char') {
    out = current.value
  } else {
    return Err(new ParseError(`expected 'char' got ${JSON.stringify(current)}`))
  }

  for (let token = tokens.next(); token !== undefined && token.type === 'char'; token = tokens.next()) {
    out += token.value
  }

  return Ok(out)
}

function consumeWhitespace (tokens: TokenIterator): void {
  while (tokens.peek()?.type === 'whitespace' || tokens.current()?.type === 'whitespace') {
    tokens.nextOrThrow()
  }
}

function parseString (tokens: TokenIterator, whitespace: boolean): Result<string, ParseError> {
  if (whitespace) {
    consumeWhitespace(tokens)
  }
  if (tokens.current() === undefined) {
    return Err(new ParseError('no more tokens when trying to parse string value'))
  }

  // Figure out what our ending delimiter will be. If we do not match on a quote, it will be the next space (unquoted strings)
  const maybeQuote = tokens.current()
  let endDelimiter = ' '

  if (maybeQuote && maybeQuote.type === 'quote') {
    endDelimiter = maybeQuote.value
    tokens.next()
  }

  let out = ''
  for (let token = tokens.current(); token && (token.type === 'char' || token.type === 'whitespace'); token = tokens.next()) {
    if (token.type === 'whitespace' && endDelimiter === ' ') {
      break
    } else if (token.type === 'char' && token.value === endDelimiter) {
      break
    } else if (token.type === 'whitespace') {
      out += ' '
    } else {
      out += token.value
    }
  }

  if (out === '') {
    return Err(new ParseError('no string value present'))
  }

  return Ok(out)
}

function extractCommand (rootKey: string, tokens: TokenIterator, commands: Record<string, InternalCommand>): [DefaultCommand | UserCommand, string | undefined] {
  const command = commands[rootKey]
  let lastKnownKey

  // If we could not locate a command, we must assume the first argument is a positional.
  // Coercion will confirm or deny this later.
  if (!command) {
    const commandResult = {
      isDefault: true
    } as const

    return [commandResult, rootKey]
  }

  let subcommand = command
  let subcommandKey: Result<string>
  const keyParts = [rootKey]
  for (subcommandKey = parseUnquoted(tokens, true); subcommandKey.ok; subcommandKey = parseUnquoted(tokens, true)) {
    if (!subcommand.inner._subcommands[subcommandKey.val]) {
      lastKnownKey = subcommandKey.val
      break
    }

    subcommand = subcommand.inner._subcommands[subcommandKey.val]
    keyParts.push(subcommandKey.val)
  }

  const commandResult = {
    isDefault: false,
    internal: subcommand, // Will resolve to the root if no subcommand was found
    keyParts
  }

  return [commandResult, lastKnownKey]
}

function parseLongFlag (tokens: TokenIterator): Result<ParsedLongArgument, ParseError> {
  const flagName = parseUnquoted(tokens, false)
  if (!flagName.ok) {
    return flagName
  }

  const values = []
  for (let value = parseString(tokens, true); value.ok; value = parseString(tokens, true)) {
    values.push(value.val)
  }

  if (!values.length) {
    return Ok({
      rawInput: `--${flagName.val}`,
      key: flagName.val,
      type: 'long',
      values: []
    })
  }

  return Ok({
    rawInput: `--${flagName.val} ${values.join(' ')}`,
    key: flagName.val,
    type: 'long',
    values
  })
}

function parseShortFlag (tokens: TokenIterator): Result<ParsedShortArugmentSingle, ParseError> {
  const flagName = parseUnquoted(tokens, false)
  if (!flagName.ok) {
    return flagName
  }

  const values = []
  for (let value = parseString(tokens, true); value.ok; value = parseString(tokens, true)) {
    values.push(value.val)
  }

  if (!values.length) {
    return Ok({
      rawInput: `-${flagName.val}`,
      key: flagName.val,
      type: 'short-single',
      values: []
    })
  }

  return Ok({
    rawInput: `-${flagName.val} ${values.join(' ')}`,
    key: flagName.val,
    type: 'short-single',
    values
  })
}

function parseFlag (tokens: TokenIterator): Result<AnyParsedFlagArgument, ParseError> {
  consumeWhitespace(tokens)

  const token = tokens.current()
  const peek = tokens.peek()

  if (!token) {
    return Err(new ParseError('out of tokens'))
  }

  if (token.type === 'flag-denotion' && peek?.type !== 'flag-denotion') {
    // Try for a short flag / group
    tokens.next()
    return parseShortFlag(tokens)
  }

  if (tokens.peek()?.type === 'flag-denotion' && peek?.type === 'flag-denotion') {
    // Try for a long flag
    tokens.next()
    tokens.next()
    return parseLongFlag(tokens)
  }

  return Err(new ParseError(`expected flag denotion, got ${JSON.stringify(token)}`))
}

export function parse (
  tokens: TokenIterator,
  commands: Record<string, InternalCommand>,
  opts: ParserOpts
): Result<ParsedArguments, ParseError> {
  const positionals: Map<number, ParsedPositionalArgument> = new Map()
  const flags: Map<string, AnyParsedFlagArgument> = new Map()

  // 1) Determine if we have a command (and maybe) a subcommand passed in the arguments
  const rootKey = parseUnquoted(tokens, true)
  let commandObject: DefaultCommand | UserCommand

  if (rootKey.ok) {
    const [commandResult, lastKnownKey] = extractCommand(rootKey.val, tokens, commands)
    commandObject = commandResult
    if (lastKnownKey) {
      positionals.set(0, {
        type: 'positional',
        index: 0,
        values: [lastKnownKey],
        rawInput: lastKnownKey
      })
    }
  } else {
    commandObject = {
      isDefault: true
    }
  }

  // 2) Parse any positionals
  let index = 0
  for (let positional = parseUnquoted(tokens, true); positional.ok; positional = parseUnquoted(tokens, true)) {
    index++
    positionals.set(index, {
      type: 'positional',
      index,
      rawInput: positional.val,
      // Uses a single element array for now. We will collate the positionals at coercion time
      // once we can associate them with their schema & figure out which args are multi types
      values: [positional.val]
    })
  }

  // 3) Parse any flags
  while (tokens.hasMoreTokens()) {
    const flagResult = parseFlag(tokens)
    if (!flagResult.ok) {
      return flagResult
    }

    const flag = flagResult.val
    const { type } = flag

    // Flags with assignable names
    if (type === 'long' || type === 'short-single') {
      flags.set(flag.key, flag)
    }
  }

  return Ok({
    command: commandObject,
    flags,
    positionals
  })
}
