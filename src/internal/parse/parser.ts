import { InternalError, ParseError } from '../../error'
import { StoredParserOpts } from '../../opts'
import { Err, Ok, Result } from '../result'
import { Token, TokenIterator, TokenType } from './lexer'
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
export interface ParsedShortArgumentSingle extends ParsedArgumentBase {
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

export type AnyParsedArgument = ParsedLongArgument | ParsedShortArgumentGroup | ParsedShortArgumentSingle | ParsedPositionalArgument
export type AnyParsedFlagArgument = ParsedLongArgument | ParsedShortArgumentSingle | ParsedShortArgumentGroup

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

function skipWhile (tokens: TokenIterator, predicate: (tok: Token) => boolean): Result<void, ParseError> {
  let token = tokens.current()
  while (token && predicate(token)) {
    token = tokens.next()
  }

  return Ok(undefined)
}

function parseUnquoted (tokens: TokenIterator, ...skipPrecedingTokens: TokenType[]): Result<string, ParseError> {
  if (skipPrecedingTokens.length) {
    skipWhile(tokens, token => skipPrecedingTokens.includes(token.type))
  }

  const current = tokens.current()
  if (!current) {
    return Err(ParseError.expected('<more tokens>', 'EOF', tokens.intoString(), tokens.index()))
  }

  let out = ''
  if (current?.type === 'char') {
    out = current.value
  } else {
    return Err(ParseError.expected('char', JSON.stringify(current), tokens.intoString(), tokens.index()))
  }

  for (let token = tokens.next(); token !== undefined; token = tokens.next()) {
    if (token.type === 'char' || token.type === 'flag-denotion') {
      // Flag denotions are valid inside unquoted strings, as we can disambiguate them
      // relatively easily, unlike quotes or whitespace
      out += token.value
    } else {
      break
    }
  }

  return Ok(out)
}

function parseString (tokens: TokenIterator, ...skipPrecedingTokens: TokenType[]): Result<string, ParseError> {
  if (skipPrecedingTokens.length) {
    skipWhile(tokens, token => skipPrecedingTokens.includes(token.type))
  }

  if (tokens.current() === undefined) {
    return Err(ParseError.expected('<more tokens>', 'EOF', tokens.intoString(), tokens.index()))
  }

  // Figure out what our ending delimiter will be. If we do not match on a quote, it will be the next space (unquoted strings)
  const maybeQuote = tokens.current()
  let endDelimiter = ' '

  if (maybeQuote && maybeQuote.type === 'quote') {
    endDelimiter = maybeQuote.value
    tokens.next()
  }

  let out = ''
  for (let token = tokens.current(); token !== undefined; token = tokens.next()) {
    // Special casing "recognised characters" (whitespace, delimiters) inside quotes so that they can be still be used in strings
    if (token.type === 'whitespace' && endDelimiter === ' ' && maybeQuote?.type !== 'quote') {
      break
    } else if (token.type === 'quote' && token.value === endDelimiter) {
      // Hit the other end of a quote, exit here and skip the quote token
      tokens.next()
      break
    } else if (token.type === 'flag-denotion' && maybeQuote?.type !== 'quote') {
      // Break out if we encounter a flag but are not in a quote context
      break
    } else {
      out += token.value
    }
  }

  // Error in cases where we could not complete the parse.
  // These should be handled by callers. In most cases, they are ignored and treated as "end of input"
  if (out === '') {
    return Err(new ParseError('no value found', tokens.intoString(), tokens.index()))
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
  for (subcommandKey = parseString(tokens, 'whitespace'); subcommandKey.ok; subcommandKey = parseString(tokens, 'whitespace')) {
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

function parseLongFlag (tokens: TokenIterator, opts: StoredParserOpts): Result<ParsedLongArgument, ParseError> {
  const flagName = parseUnquoted(tokens, 'whitespace')
  if (!flagName.ok) {
    return flagName
  }

  const values = []
  const tokensToSkip: TokenType[] = ['whitespace']
  if (opts.keyEqualsValueSyntax) {
    tokensToSkip.push('equals')
  }

  for (let value = parseString(tokens, ...tokensToSkip); value.ok; value = parseString(tokens, ...tokensToSkip)) {
    if (value.val.includes('=') && !opts.keyEqualsValueSyntax) {
      return Err(new ParseError(`encountered k=v syntax when parsing '--${flagName.val}', but k=v syntax is disabled`, tokens.intoString(), tokens.index()))
    }
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

function parseShortFlag (tokens: TokenIterator, opts: StoredParserOpts): Result<ParsedShortArgumentSingle | ParsedShortArgumentGroup, ParseError> {
  const flagName = parseUnquoted(tokens, 'whitespace')
  if (!flagName.ok) {
    return flagName
  }

  const tokensToSkip: TokenType[] = ['whitespace']
  if (opts.keyEqualsValueSyntax) {
    tokensToSkip.push('equals')
  }

  const values = []
  for (let value = parseString(tokens, ...tokensToSkip); value.ok; value = parseString(tokens, ...tokensToSkip)) {
    if (value.val.includes('=') && !opts.keyEqualsValueSyntax) {
      return Err(new ParseError(`encountered k=v syntax when parsing '-${flagName.val}', but k=v syntax is disabled`, tokens.intoString(), tokens.index()))
    }
    values.push(value.val)
  }

  // We to assume all short flags of length 1 that do not have any values, `-f` are singles
  if (!values.length && flagName.val.length === 1) {
    return Ok({
      rawInput: `-${flagName.val}`,
      key: flagName.val,
      type: 'short-single',
      values: []
    })
  }

  // .. and that short flags with length > 1 that do not have any values, `-fyz` are grouped
  if (!values.length && flagName.val.length > 1) {
    if (!opts.shortFlagGroups) {
      return Err(new ParseError(`encountered short flag group '-${flagName.val}', but short flag grouping is disabled.`, tokens.intoString(), tokens.index()))
    }

    return Ok({
      rawInput: `-${flagName.val}`,
      key: flagName.val,
      type: 'short-group',
      flags: flagName.val.split('')
    })
  }

  return Ok({
    rawInput: `-${flagName.val} ${values.join(' ')}`,
    key: flagName.val,
    type: 'short-single',
    values
  })
}

function parseFlag (tokens: TokenIterator, opts: StoredParserOpts): Result<AnyParsedFlagArgument, ParseError> {
  skipWhile(tokens, token => token.type === 'whitespace')

  const token = tokens.current()
  const peek = tokens.peek()

  if (!token) {
    throw new InternalError('no tokens left when trying to parse out the flag')
  }

  if (token.type === 'flag-denotion' && peek?.type !== 'flag-denotion') {
    // Try for a short flag / group
    tokens.next()
    return parseShortFlag(tokens, opts)
  }

  if (tokens.peek()?.type === 'flag-denotion' && peek?.type === 'flag-denotion') {
    // Try for a long flag
    tokens.next()
    tokens.next()
    return parseLongFlag(tokens, opts)
  }

  return Err(ParseError.expected('flag', JSON.stringify(token), tokens.intoString(), tokens.index()))
}

export function parse (
  tokens: TokenIterator,
  commands: Record<string, InternalCommand>,
  opts: StoredParserOpts
): Result<ParsedArguments, ParseError> {
  const positionals: Map<number, ParsedPositionalArgument> = new Map()
  const flags: Map<string, AnyParsedFlagArgument> = new Map()

  // 1) Determine if we have a command (and maybe) a subcommand passed in the arguments
  const rootKey = parseString(tokens, 'whitespace')
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
  for (let positional = parseUnquoted(tokens, 'whitespace'); positional.ok; positional = parseUnquoted(tokens, 'whitespace')) {
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
    const flagResult = parseFlag(tokens, opts)
    if (!flagResult.ok) {
      return flagResult
    }

    const flag = flagResult.val
    const { type } = flag

    // Flags with assignable names
    if (type === 'long' || type === 'short-single') {
      flags.set(flag.key, flag)
    }

    if (type === 'short-group') {
      for (const key of flag.flags) {
        flags.set(key, flag)
      }
    }
  }

  return Ok({
    command: commandObject,
    flags,
    positionals
  })
}
