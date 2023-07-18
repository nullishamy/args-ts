import { ArgumentType } from '../types'

interface ParseResultOk<T> {
  ok: true
  oldValue: string
  parsedValue: T
}
interface ParseResultErr {
  ok: false
  value: string
  error: Error
}

export type ParseResult<T> = ParseResultOk<T> | ParseResultErr

export abstract class Argument<TArgType> {
  public _default: TArgType | undefined = undefined
  public _optional: boolean = false
  public _dependencies: string[] = []

  protected constructor (public readonly type: ArgumentType) {}

  public abstract parse (value: string): ParseResult<TArgType> | Promise<ParseResult<TArgType>>

  public optional (): Argument<TArgType | undefined> {
    this._optional = true
    return this
  }

  public default (arg: TArgType): Argument<TArgType> {
    this._default = arg
    return this
  }

  public dependsOn (arg: `--${string}`): Argument<TArgType> {
    this._dependencies.push(arg.substring(2))
    return this
  }
}

export * as a from './parsers'
