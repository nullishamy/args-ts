import { StoredParserOpts } from '../opts'

export abstract class Resolver {
  public constructor (
    public readonly identifier: string
  ) {}

  abstract keyExists (key: string, opts: StoredParserOpts): boolean
  abstract resolveKey (key: string, opts: StoredParserOpts): string | undefined
}
