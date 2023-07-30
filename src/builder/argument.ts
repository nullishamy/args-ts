import { CoercionError } from '../error'

interface CoercionResultOk<T> {
  ok: true
  passedValue: string
  returnedValue: T
}
interface CoercionResultErr {
  ok: false
  passedValue: string
  error: CoercionError
}

export type CoercionResult<T> = CoercionResultOk<T> | CoercionResultErr

export type ArgumentType = 'boolean' | 'string' | 'number' | 'array' | 'custom'

export abstract class Argument<T> {
  public _default: T | undefined = undefined
  public _optional: boolean = false
  public _isMultiType: boolean = false
  public _dependencies: string[] = []

  protected constructor (public readonly type: ArgumentType, isMultiType: boolean = false) {
    this._isMultiType = isMultiType
  }

  protected err (passedValue: string, error: Error): CoercionResultErr {
    return {
      ok: false,
      passedValue,
      error
    }
  }

  protected ok (passedValue: string, returnedValue: T): CoercionResultOk<T> {
    return {
      ok: true,
      passedValue,
      returnedValue
    }
  }

  public abstract coerce (value: string): Promise<CoercionResult<T>>

  public optional (): Argument<T | undefined> {
    this._optional = true
    return this
  }

  public required (): Argument<NonNullable<T>> {
    this._optional = false
    return this as Argument<NonNullable<T>>
  }

  public default (arg: T): Argument<T> {
    this._default = arg
    return this
  }

  public dependsOn (arg: `--${string}`): Argument<T> {
    this._dependencies.push(arg.substring(2))
    return this
  }

  public array (): Argument<T[]> {
    this._isMultiType = true
    // Unfortunate type hackery here. We simply tell the parser to treat this as an array (arrays cannot have mixed elements)
    // and it will output that into the result. This is still *safe* because this function call is intrinsicly tied to the type
    // but it is still type hackery
    return this as Argument<T[]>
  }
}
