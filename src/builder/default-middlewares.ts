import { StoredParserOpts } from '../opts'
import { Middleware } from './middleware'

export class EnvironmentMiddleware extends Middleware {
  keyExists (key: string, opts: StoredParserOpts): boolean {
    const envKey = `${opts.environmentPrefix}_${key.toUpperCase()}`
    return process.env[envKey] !== undefined
  }

  resolveKey (key: string, opts: StoredParserOpts): string | undefined {
    const envKey = `${opts.environmentPrefix}_${key.toUpperCase()}`
    return process.env[envKey]
  }
}
