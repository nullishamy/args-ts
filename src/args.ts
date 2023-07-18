import { Argument } from './builder'
import { ParseError } from './error'
import { tokenise, parse, matchValuesWithDeclarations, WrappedDeclaration } from './parser'
export interface Opts {
  name: string
  description: string
  unknownArgBehaviour: 'skip' | 'throw'
}

export class Args<TArgTypes = {
  [k: string]: boolean | string | number | undefined
}> {
  private declarations: Record<string, WrappedDeclaration> = {}

  constructor (private readonly opts: Opts) {}

  public add<
    // The declared argument type
    TArg,
    // The long declaration of the argument, used to setup the keys in the parsed object
    TLong extends string,
    // The return type of the custom argument function, used for inference
    TRet = never,
  >(
    // We don't need to care about the actual value of the short flag, we are only
    // going to provide the keys for the long variant. This is mostly because handling both keys,
    // particularly in the type system, is very annoying and overall very un-needed.
    [longFlag, shortFlag]: [`--${TLong}`, `-${string}`?],
    declaration: Argument<TArg>
  ): Args<TArgTypes & {
      // Syntax to add a key to a type
      [key in TLong]:
      // If we get passed a function, take its return type instead of the lookup table type
      // Then combined with the above syntax, add it to our arg types by the long key and the discovered value type
      TArg extends ((input: string) => never)
        ? TRet
        : TArg
    }> {
    if (!longFlag.startsWith('--')) {
      throw new ParseError(`long flags must start with '--', got '${longFlag}'`)
    }

    if (this.declarations[longFlag.substring(2)]) {
      throw new ParseError(`duplicate long flag '${longFlag}'`)
    }

    this.declarations[longFlag.substring(2)] = {
      inner: declaration,
      longFlag: longFlag.substring(2),
      shortFlag: shortFlag?.substring(1)
    }

    if (shortFlag) {
      if (!shortFlag.startsWith('-')) {
        throw new ParseError(`short flags must start with '-', got '${shortFlag}'`)
      }

      if (this.declarations[shortFlag.substring(1)]) {
        throw new ParseError(`duplicate short flag '${shortFlag}'`)
      }

      this.declarations[shortFlag.substring(1)] = {
        inner: declaration,
        longFlag: longFlag.substring(2),
        shortFlag: shortFlag.substring(1)
      }
    }

    // @ts-expect-error inferrence is broken
    return this
  }

  public async parse (argString: string): Promise<TArgTypes> {
    const tokens = tokenise(argString)
    const parsed = parse(tokens)
    const matched = await matchValuesWithDeclarations(parsed, this.declarations, this.opts)
    return Object.fromEntries([...matched.entries()].map(([key, value]) => [key.longFlag, value.parsed])) as TArgTypes
  }

  public reset (): void {
    this.declarations = {}
  }
}
