import { currentPlatform } from '../internal/platform'
import { StoredParserOpts } from '../opts'
import { Resolver } from './resolver'

export class EnvironmentResolver extends Resolver {
  keyExists (key: string, opts: StoredParserOpts): boolean {
    const envKey = `${opts.environmentPrefix}_${key.toUpperCase()}`
    const platform = currentPlatform()
    return platform.getEnv(envKey) !== undefined
  }

  resolveKey (key: string, opts: StoredParserOpts): string {
    const envKey = `${opts.environmentPrefix}_${key.toUpperCase()}`
    const platform = currentPlatform()
    const value = platform.getEnv(envKey)
    if (value === undefined) {
      throw new TypeError('value was undefined, but keyExists must have been true')
    }
    return value
  }
}
