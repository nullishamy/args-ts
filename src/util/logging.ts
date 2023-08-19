interface Stringifiable { toString: () => string }
type LoggingFunction<T> = (...args: Stringifiable[]) => T

const LEVEL_TO_CONSOLE: Record<LogLevel, () => (...args: unknown[]) => void> = {
  trace: () => console.trace,
  debug: () => console.debug,
  info: () => console.log,
  warn: () => console.warn,
  error: () => console.error,
  fatal: () => console.error
}

const LEVEL_TO_NUMBER: Record<LogLevel, number> = {
  trace: 0,
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  fatal: 50
}

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'

export class Logger {
  trace = this.makeLevelFunc('trace', false)
  debug = this.makeLevelFunc('debug', false)
  info = this.makeLevelFunc('info', false)
  warn = this.makeLevelFunc('warn', false)
  error = this.makeLevelFunc('error', false)
  fatal = this.makeLevelFunc('fatal', true)

  private level: LogLevel = 'info'
  constructor (public readonly name: string) {}

  setLevel (level: LogLevel): this {
    this.level = level
    return this
  }

  private makeLevelFunc (level: LogLevel, exit: true): LoggingFunction<never>
  private makeLevelFunc (level: LogLevel, exit: false): LoggingFunction<void>
  private makeLevelFunc (level: LogLevel, exit: boolean): LoggingFunction<void> {
    return (...args) => {
      const ourLevel = LEVEL_TO_NUMBER[this.level]
      const targetLevel = LEVEL_TO_NUMBER[level]

      if (ourLevel >= targetLevel) {
        return
      }

      const fn = LEVEL_TO_CONSOLE[this.level]()
      fn(`[${this.name}]`, new Date().toISOString(), ':', ...args)

      if (exit) {
        process.exit()
      }
    }
  }
}
