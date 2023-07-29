import { Err, Ok, Result } from '../result'

export type TokenType = 'flag' | 'ident' | 'value'

export interface FlagToken {
  type: 'flag-denotion'
}

export interface IdentToken {
  type: 'ident'
  lexeme: string
}

export interface ValueToken {
  type: 'value'
  userValue: string
}

export type Token = FlagToken | IdentToken | ValueToken

export class TokenIterator {
  private idx = 0
  constructor (private readonly tokens: Token[]) {}

  get (index: number): Token | undefined {
    return this.tokens[index]
  }

  next (): Token {
    if (this.idx + 1 >= this.tokens.length) {
      throw new Error(`out of bounds for length ${this.tokens.length} @ index ${this.idx} + 1`)
    }
    this.idx++
    return this.tokens[this.idx]
  }

  current (): Token {
    return this.tokens[this.idx]
  }

  peek (): Token | undefined {
    return this.tokens[this.idx + 1]
  }

  hasMoreTokens (): boolean {
    return this.idx + 1 < this.tokens.length
  }
}

export function tokenise (argString: string): Result<TokenIterator, Error> {
  if (typeof argString !== 'string') {
    return Err(new TypeError(`expected 'string', got ${typeof argString} (${argString})`))
  }

  const tokens: Token[] = []
  const chars = [...argString]
  let index = 0

  while (index < chars.length) {
    if (chars[index] === '-') {
      tokens.push({
        type: 'flag-denotion'
      })
      index++

      // End of flag denotion, start of ident
      if (chars[index] !== '-') {
        let ident = ''

        while (index < chars.length && chars[index] !== ' ') {
          ident += chars[index++]
        }

        tokens.push({
          type: 'ident',
          lexeme: ident
        })
      }
    } else if (chars[index] === ' ') {
      index++
    } else if (chars[index] === '"' || chars[index] === "'") {
      const quoteType = chars[index++]
      let stringValue = ''

      while (index < chars.length && chars[index] !== quoteType) {
        stringValue += chars[index++]
      }

      index++ // Skip the end quote

      tokens.push({
        type: 'value',
        userValue: stringValue
      })
    } else {
      // Assume anything else before a space is a value (unquoted strings, numbers)
      let stringValue = ''
      while (chars[index] !== ' ' && index < chars.length) {
        stringValue += chars[index++]
      }
      tokens.push({
        type: 'value',
        userValue: stringValue
      })
    }
  }

  return Ok(new TokenIterator(tokens))
}
