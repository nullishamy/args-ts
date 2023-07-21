import { Args, ParserOpts } from './args'
import { Argument, Command, ParseResult } from './builder'
import { ParseError } from './error'
export interface WrappedDeclaration {
  inner: Argument<any>
  longFlag: string
  shortFlag: string | undefined
}

export interface WrappedCommand {
  inner: Command
  name: string
  parser: Args<unknown>
  aliases: string[]
}

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
  values: ValueToken[]
}

export function parseArgumentTokens (tokens: Token[]): ParsedPair[] {
  const values: ParsedPair[] = []
  let index = 0

  while (index < tokens.length) {
    if (tokens[index].type === 'flag-denotion') {
      // Consume one more flag denotion if it exists (long flag form)
      if (tokens[index + 1].type === 'flag-denotion') {
        index++
      }

      const ident = tokens[++index]

      if (!ident || ident.type !== 'ident') {
        throw new ParseError(`expected identifier, got ${ident?.type}`)
      }

      index++

      const valueTokens = []

      while (index < tokens.length) {
        const token = tokens[index]
        if (token.type === 'value') {
          valueTokens.push(token)
        } else {
          break
        }
        index++
      }

      values.push({
        ident,
        values: valueTokens
      })

      index++
    } else {
      throw new ParseError(`unexpected token ${JSON.stringify(tokens[index])}`)
    }
  }

  return values
}

export interface RuntimeValue {
  pair: ParsedPair | undefined
  declaration: WrappedDeclaration
  parsed: unknown[]
}

export async function coerceParsedValues (
  values: ParsedPair[],
  declarations: Record<string, WrappedDeclaration>,
  opts: ParserOpts
): Promise<Map<WrappedDeclaration, RuntimeValue>> {
  const out = new Map<WrappedDeclaration, RuntimeValue>()

  // First, iterate the declarations, to weed out any missing arguments
  for (const declaration of Object.values(declarations)) {
    const token = values.find(v => v.ident.lexeme === declaration.longFlag || v.ident.lexeme === declaration.shortFlag)

    // The token does not exist, or the value within the token does not exist ('--value <empty>' cases)
    const defaultValue = declaration.inner._default

    if (!token && !declaration.inner._optional) {
      throw new ParseError(`argument '--${declaration.longFlag}' is missing`)
    }

    if (!declaration.inner._optional && defaultValue === undefined && !token?.values.length) {
      throw new Error(`argument '${declaration.longFlag}' is not declared as optional, does not have a default, and was not provided a value`)
    }

    const dependencies = declaration.inner._dependencies ?? []
    for (const dependency of dependencies) {
      const dependencyValue = values.find(v => v.ident.lexeme === dependency)
      if (!dependencyValue) {
        throw new ParseError(`unmet dependency '--${dependency}' for '--${declaration.longFlag}'`)
      }
    }

    let parsingResults: Array<ParseResult<any>> = []
    const inputValues = token?.values?.map(v => v.userValue) ?? []

    // If the user passes any values, parse them all
    if (inputValues.length) {
      try {
        parsingResults = await declaration.inner.parseMulti(inputValues)
      } catch (err) {
        throw new ParseError(`user callback threw error: ${(err as Error)?.message ?? err}`, {
          cause: err
        })
      }
    } else {
      parsingResults.push({
        ok: true,
        passedValue: `<no value passed for --${declaration.longFlag}>`,
        returnedValue: defaultValue
      })
    }

    // Check if any parses failed
    // for-i loop so we can provide some more diagnostics (index)
    const errors: Array<{ index: number, error: Error, value: string }> = []
    const parsedValues: unknown[] = []

    for (let i = 0; i < parsingResults.length; i++) {
      const result = parsingResults[i]

      if (result.ok) {
        parsedValues.push(result.returnedValue)
      } else {
        errors.push({
          index: i,
          value: result.passedValue,
          error: result.error
        })
      }
    }

    if (errors.length) {
      throw new ParseError(`encountered ${errors.length} error(s) whilst parsing:\n\n${errors.map(e => `error "${e.error.message}" whilst parsing "--${declaration.longFlag} ${e.value}" (argument number ${e.index + 1})`).join('\n\n')}`)
    }

    out.set(declaration, {
      declaration,
      pair: token,
      parsed: parsedValues
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
