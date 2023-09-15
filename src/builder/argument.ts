import { CoercedValue } from '../internal/parse/types'
import { ArgumentOpts, defaultArgumentOpts } from '../opts'

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

interface ArgumentState<T> {
  resolveDefault: (specificity: 'specified' | 'unspecified') => Promise<T | undefined>
  dependencies: string[]
  requiredUnlessPresent: string[]
  conflicts: string[]
  description: string | undefined
  optional: boolean
  isMultiType: boolean
  exclusive: boolean
  otherParsers: Array<MinimalArgument<CoercedValue>>
  opts: ArgumentOpts
}

/**
 * @internal
 */
export type MinimalArgument<T> = Pick<Argument<T>, '_state' | 'coerce' | 'type' | 'negate'>

export abstract class Argument<T> {
  protected _specifiedDefault: T | undefined = undefined
  protected _unspecifiedDefault: T | undefined = undefined
  protected _dependencies: string[] = []
  protected _conflicts: string[] = []
  protected _requiredUnlessPresent: string[] = []
  protected _description: string | undefined
  protected _optional: boolean = false
  protected _isMultiType: boolean = false
  protected _exclusive: boolean = false
  protected _otherParsers: Array<MinimalArgument<CoercedValue>> = []
  protected _negated: boolean = false
  protected _opts: ArgumentOpts = { ...defaultArgumentOpts }

  // Internal getter to avoid cluttering completion with ^ our private fields that need to be accessed by other internal APIs
  // Conveniently also means we encapsulate our data, so it cannot be easily tampered with by consumers
  /**
   * @internal
   */
  get _state (): ArgumentState<T> {
    return {
      resolveDefault: this.resolveDefault.bind(this),
      dependencies: this._dependencies,
      requiredUnlessPresent: this._requiredUnlessPresent,
      description: this._description,
      conflicts: this._conflicts,
      optional: this._optional,
      isMultiType: this._isMultiType,
      exclusive: this._exclusive,
      otherParsers: this._otherParsers,
      opts: this._opts
    }
  }

  protected constructor (public type: ArgumentType, isMultiType: boolean = false) {
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

  protected async resolveDefault (specificity: 'specified' | 'unspecified'): Promise<T | undefined> {
    if (specificity === 'specified') {
      return this._specifiedDefault
    }

    return this._unspecifiedDefault
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
   * Sets a single option on this argument.
   * This does not copy the provided value.
   * @param key - The key to set
   * @param value - The value to set the key to
   * @returns this
   */
  public opt <K extends keyof ArgumentOpts> (key: K, value: ArgumentOpts[K]): Argument<T> {
    this._opts[key] = value
    return this
  }

  /**
   * Configures a new options object for this argument.
   * This will not deep copy the provided object, which may be mutated
   * by subsequent calls on this object.
   * @param newOpts - The new options to set
   * @returns this
   */
  public opts (newOpts: ArgumentOpts): Argument<T> {
    this._opts = newOpts
    return this
  }

  /**
   * Inverts the negation status for this argument. Negation is handled independently (or not at all)
   * by each argument type as it coerces a value.
   * @returns this
   */
  public negate (): Argument<T> {
    this._negated = !this._negated
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

  /**
   * Add another parser to this argument, enabling either argument to be used to coerce the value
   * @param other - the other parser to use
   * @returns this
   */
  public or <U extends CoercedValue> (other: Argument<U>): Omit<Argument<T | U>, 'array'> {
    this._otherParsers.push(other)
    return this
  }
}
