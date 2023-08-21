import { currentPlatform } from '../internal/platform'
import { StoredParserOpts } from '../opts'
import { Resolver } from './resolver'

export class EnvironmentResolver extends Resolver {
  keyExists (key: string, opts: StoredParserOpts): boolean {
    const envKey = `${opts.environmentPrefix}_${key.toUpperCase()}`
    const platform = currentPlatform()
    return platform.getEnv(envKey) !== undefined
  }

  resolveKey (key: string, opts: StoredParserOpts): string | undefined {
    const envKey = `${opts.environmentPrefix}_${key.toUpperCase()}`
    const platform = currentPlatform()
    return platform.getEnv(envKey)
  }
}
