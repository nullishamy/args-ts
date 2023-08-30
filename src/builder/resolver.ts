import { StoredParserOpts } from '../opts'

/**
 * Represents a secondary resolution source (after user arguments) for which argument values can be obtained.
 *
 * These sources may be from a network, from the file system, or from the environment.
 */
export abstract class Resolver {
  public constructor (
    public readonly identifier: string
  ) {}

  /**
   * Determine whether this resolver can resolve the provided key.
   * @param key - The key to check
   * @param opts - The parser opts
   */
  abstract keyExists (key: string, opts: StoredParserOpts): boolean
  /**
   * Resolve the provided key to its string value.
   *
   * This value should not be validated in any way other than ensuring it is not nullish.
   * @param key - The key to resolve
   * @param opts - The parser opts
   */
  abstract resolveKey (key: string, opts: StoredParserOpts): string
}
