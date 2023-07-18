import { ParseResult } from './builder'
import { ParseError } from './error'
import { ParserOpts, WrappedDeclaration } from './types.js'

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

export function tokenise (argString: string): Token[] {
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

  return tokens
}

export interface ParsedPair {
  ident: IdentToken
  value?: ValueToken
}

export function parse (tokens: Token[]): ParsedPair[] {
  const values: ParsedPair[] = []
  let index = 0

  while (index < tokens.length) {
    if (tokens[index].type === 'flag-denotion') {
      // Consume one more flag denotion if it exists (long flag form)
      if (tokens[index + 1].type === 'flag-denotion') {
        index++
      }

      const [ident, value] = [tokens[++index], tokens[++index]]

      if (!ident || ident.type !== 'ident') {
        throw new ParseError(`expected identifier, got ${ident?.type}`)
      }

      if (value && value.type !== 'value') {
        throw new ParseError(`expected value, got ${value?.type}`)
      }

      values.push({
        ident,
        value
      })

      index++
    } else {
      throw new ParseError(`unexepcted token ${JSON.stringify(tokens[index])}`)
    }
  }

  return values
}

export interface MatchedValue {
  pair: ParsedPair | undefined
  declaration: WrappedDeclaration
  parsed: unknown
}

export async function matchValuesWithDeclarations (
  values: ParsedPair[],
  declarations: Record<string, WrappedDeclaration>,
  opts: ParserOpts
): Promise<Map<WrappedDeclaration, MatchedValue>> {
  const out = new Map<WrappedDeclaration, MatchedValue>()

  // First, iterate the declarations, to weed out any missing arguments
  for (const declaration of Object.values(declarations)) {
    const token = values.find(v => v.ident.lexeme === declaration.longFlag || v.ident.lexeme === declaration.shortFlag)

    // The token does not exist, or the value within the token does not exist ('--value <empty>' cases)
    const defaultValue = declaration.inner._default

    if (!token && !declaration.inner._optional) {
      throw new ParseError(`argument '--${declaration.longFlag}' is missing`)
    }

    if (!declaration.inner._optional && defaultValue === undefined && !token?.value) {
      throw new Error(`argument '${declaration.longFlag}' is not declared as optional, does not have a default, and was not provided a value`)
    }

    const dependencies = declaration.inner._dependencies ?? []
    for (const dependency of dependencies) {
      const dependencyValue = values.find(v => v.ident.lexeme === dependency)
      if (!dependencyValue) {
        throw new ParseError(`unmet dependency '--${dependency}' for '--${declaration.longFlag}'`)
      }
    }

    let parsedValueResult: ParseResult<any>
    const inputValue = token?.value?.userValue
    if (inputValue) {
      // User specified input, parse it
      try {
        parsedValueResult = await declaration.inner.parse(inputValue)
      } catch (err) {
        throw new ParseError(`user callback threw error: ${(err as Error)?.message ?? err}`, {
          cause: err
        })
      }
    } else {
      parsedValueResult = {
        ok: true,
        passedValue: '<unknown>',
        returnedValue: defaultValue
      }
    }

    if (!parsedValueResult.ok) {
      throw new ParseError(`encountered error whilst parsing: ${parsedValueResult.error.message}`, {
        cause: parsedValueResult.error
      })
    }

    out.set(declaration, {
      declaration,
      pair: token,
      parsed: parsedValueResult.returnedValue
    })
  }

  // Then, iterate the parsed values, to weed out excess arguments
  for (const value of values) {
    const declaration = declarations[value.ident.lexeme]
    // If we do not find a declaration, follow config to figure out what to do for excess arguments
    if (!declaration) {
      const { unknownArgBehaviour } = opts
      if (unknownArgBehaviour === 'throw') {
        throw new ParseError(`unexpected argument '--${value.ident.lexeme}'`)
      }

      // Otherwise, skip it
      continue
    }
  }

  return out
}
