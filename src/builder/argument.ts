interface CoercionResultOk<T> {
  ok: true
  passedValue: string
  returnedValue: T
}
interface CoercionResultErr {
  ok: false
  passedValue: string
  error: Error
}

export type CoercionResult<T> = CoercionResultOk<T> | CoercionResultErr

export type ArgumentType = string

interface ArgumentMeta<T> {
  specifiedDefault: T | undefined
  dependencies: string[]
  requiredUnlessPresent: string[]
  conflicts: string[]
  unspecifiedDefault: T | undefined
  description: string | undefined
  optional: boolean
  isMultiType: boolean
  exclusive: boolean
}

export type MinimalArgument<T> = Pick<Argument<T>, '_meta' | 'coerce' | 'type'>

export abstract class Argument<T> {
  protected _specifiedDefault: T | undefined = undefined
  protected _dependencies: string[] = []
  protected _conflicts: string[] = []
  protected _requiredUnlessPresent: string[] = []
  protected _unspecifiedDefault: T | undefined = undefined
  protected _description: string | undefined
  protected _optional: boolean = false
  protected _isMultiType: boolean = false
  protected _exclusive: boolean = false

  // Internal getter to avoid cluttering completion with ^ our private fields that need to be accessed by other internal APIs
  // Conveniently also means we encapsulate our data, so it cannot be easily tampered with by outside people (assuming they do not break type safety)
  get _meta (): ArgumentMeta<T> {
    return {
      specifiedDefault: this._specifiedDefault,
      dependencies: this._dependencies,
      unspecifiedDefault: this._unspecifiedDefault,
      requiredUnlessPresent: this._requiredUnlessPresent,
      description: this._description,
      conflicts: this._conflicts,
      optional: this._optional,
      isMultiType: this._isMultiType,
      exclusive: this._exclusive
    }
  }

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

  /**
   * Try to coerce a string value into the (`T`) type of this Argument.
   *
   * Generally an internal API but it is safe for public consumption, if you wish to compose
   * the default coercion types with your own.
   * @param value - the value to coerce
   */
  public abstract coerce (value: string): Promise<CoercionResult<T>>

  /**
   * Mark this argument as required unless the specified argument is passed
   * @param arg - the argument which will be checked against
   * @returns this
   */
  public requireUnlessPresent (arg: `--${string}`): Argument<T> {
    this._requiredUnlessPresent.push(arg.substring(2))
    return this
  }

  /**
   * Marks this argument as optional, meaning it does not need a value, and does not need to be specified in the arguments.
   * @returns this
   */
  public optional (): Omit<Argument<T | undefined>, 'required' | 'default'> {
    this._optional = true
    return this
  }

  /**
   * Marks this argument as required, meaning it does need a value, and does need to be specified in the arguments.
   * @returns this
   */
  public required (): Omit<Argument<NonNullable<T>>, 'optional'> {
    this._optional = false
    return this as Argument<NonNullable<T>>
  }

  /**
   * Sets the default value for when an argument is not specified in the arguments
   * @see Argument#presentDefault
   * @returns this
   */
  public default (arg: T): Omit<Argument<T>, 'required'> {
    this._unspecifiedDefault = arg
    this._optional = true
    return this
  }

  /**
   * Sets the default value for when an argument is specified in the arguments, but not given a value.
   * @see Argument#default
   * @returns this
   */
  public presentDefault (arg: T): Omit<Argument<T>, 'required'> {
    this._specifiedDefault = arg
    this._optional = true
    return this
  }

  /**
   * Marks that this argument depends on another, meaning if this argument is given, the other must be given.
   * @param arg - the argument which this argument depends on
   * @returns this
   */
  public dependsOn (arg: `--${string}`): Argument<T> {
    this._dependencies.push(arg.substring(2))
    return this
  }

  /**
   * Marks that this argument conflicts with another, meaning if this argument is given, the other must not be given.
   * @param arg - the argument which this argument conflicts with
   * @returns this
   */
  public conflictsWith (arg: `--${string}`): Argument<T> {
    this._conflicts.push(arg.substring(2))
    return this
  }

  /**
   * Provide a description for this argument, for use in the help message.
   * @param description - the description of this argument
   * @returns this
   */
  public describe (description: string): Argument<T> {
    this._description = description
    return this
  }

  /**
   * Marks this argument as exclusive, meaning no other arguments can be passed with it.
   * @returns this
   */
  public exclusive (): Omit<Argument<T>, 'dependsOn' | 'conflictsWith'> {
    this._exclusive = true
    return this
  }

  /**
   * Marks this argument as a multi type, meaning many values can be passed to it.
   * @returns this
   */
  public array (): Argument<T[]> {
    this._isMultiType = true
    // Unfortunate type hackery here. We simply tell the parser to treat this as an array (arrays cannot have mixed elements)
    // and it will output that into the result. This is still *safe* because this function call is intrinsicly tied to the type
    // but it is still type hackery
    return this as Argument<T[]>
  }
}
