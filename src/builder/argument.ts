interface ParseResultOk<T> {
  ok: true
  passedValue: string
  returnedValue: T
}
interface ParseResultErr {
  ok: false
  passedValue: string
  error: Error
}

export type ParseResult<T> = ParseResultOk<T> | ParseResultErr

export type ArgumentType = 'boolean' | 'string' | 'number' | 'array' | 'custom'

export abstract class Argument<TArgType> {
  public _default: TArgType | undefined = undefined
  public _optional: boolean = false
  public _isMultiType: boolean = false
  public _dependencies: string[] = []

  protected constructor (public readonly type: ArgumentType, isMultiType: boolean = false) {
    this._isMultiType = isMultiType
  }

  public abstract parse (value: string): Promise<ParseResult<TArgType>>

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

  public array (): Argument<TArgType[]> {
    this._isMultiType = true
    // Unfortunate type hackery here. We simply tell the parser to treat this as an array (arrays cannot have mixed elements)
    // and it will output that into the result. This is still *safe* because this function call is intrinsicly tied to the type
    // but it is still type hackery
    return this as Argument<TArgType[]>
  }
}
