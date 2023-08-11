import { Err, Ok, Result } from '../result'

export interface FlagToken {
  type: 'flag-denotion'
  value: '-'
}

export interface QuoteToken {
  type: 'quote'
  value: string
}

export interface CharToken {
  type: 'char'
  value: string
}

export interface WhitespaceToken {
  type: 'whitespace'
  value: ' '
}

export interface EqualsToken {
  type: 'equals'
  value: '='
}

export type Token = FlagToken | QuoteToken | CharToken | WhitespaceToken | EqualsToken
export type TokenType = Token['type']

export class TokenIterator {
  private idx = 0
  constructor (private readonly tokens: Token[]) {
  }

  toArray (): Token[] {
    return [...this.tokens]
  }

  index (): number {
    return this.idx
  }

  get (index: number): Token | undefined {
    return this.tokens[index]
  }

  next (): Token | undefined {
    this.idx++
    return this.tokens[this.idx]
  }

  nextOrThrow (message = 'no more tokens'): Token {
    const token = this.next()
    if (!token) {
      throw new TypeError(message)
    }

    return token
  }

  current (): Token | undefined {
    if (!this.tokens.length) {
      return undefined
    }
    return this.tokens[this.idx]
  }

  peek (): Token | undefined {
    return this.tokens[this.idx + 1]
  }

  hasMoreTokens (): boolean {
    return this.idx + 1 < this.tokens.length
  }

  intoString (): string {
    return this.tokens.map(t => t.value).join('')
  }
}

export function tokenise (argString: string): Result<TokenIterator, Error> {
  if (typeof argString !== 'string') {
    return Err(new TypeError(`expected 'string', got ${typeof argString} (${argString})`))
  }

  const tokens: Token[] = []

  for (const char of argString) {
    if (char === '-') {
      tokens.push({
        type: 'flag-denotion',
        value: char
      })
      continue
    }

    if (char === '"' || char === "'") {
      tokens.push({
        type: 'quote',
        value: char
      })
      continue
    }

    if (char === ' ') {
      tokens.push({
        type: 'whitespace',
        value: char
      })
      continue
    }

    if (char === '=') {
      tokens.push({
        type: 'equals',
        value: char
      })
      continue
    }

    tokens.push({
      type: 'char',
      value: char
    })
  }

  return Ok(new TokenIterator(tokens))
}
