import { Argument, CoercionResult } from '.'

function makeExport <T, TConst extends new (...args: any[]) => T> (ArgClass: TConst): (...args: ConstructorParameters<TConst>) => T {
  return (...args: any[]) => new ArgClass(...args)
}

class StringArgument extends Argument<string> {
  private _regex: RegExp | undefined
  private _minLength: number | undefined
  private _maxLength: number | undefined

  constructor () {
    super('string')
  }

  matches (regex: RegExp): StringArgument {
    this._regex = regex
    return this
  }

  max (length: number): StringArgument {
    this._maxLength = length
    return this
  }

  min (length: number): StringArgument {
    this._minLength = length
    return this
  }

  notBlank (): StringArgument {
    this.type = 'non-blank string'
    return this.matches(/(.|\s)*\S(.|\s)*/)
  }

  async coerce (value: string): Promise<CoercionResult<string>> {
    if (this._regex) {
      const match = value.match(this._regex)
      if (!match?.length) {
        return this.err(value, new Error(`'${value}' does not match '${this._regex}'`))
      }
    }

    if (this._minLength && value.length < this._minLength) {
      return this.err(value, new Error(`value must be at least length ${this._minLength}, got '${value}'`))
    }

    if (this._maxLength && value.length > this._maxLength) {
      return this.err(value, new Error(`value must be at most length ${this._maxLength}, got '${value}'`))
    }
    return this.ok(value, value)
  }
}

class NumberArgument extends Argument<number> {
  private _lowerBound: number | undefined = undefined
  private _upperBound: number | undefined = undefined

  constructor () {
    super('number')
  }

  async coerce (value: string): Promise<CoercionResult<number>> {
    const num = parseInt(value, 10)
    if (isNaN(num)) {
      return this.err(value, new Error(`'${value}' is not a number`))
    }

    if (this._lowerBound && num < this._lowerBound) {
      return this.err(value, new Error(`${value} is less than lower bound ${this._lowerBound}`))
    }

    if (this._upperBound && num > this._upperBound) {
      return this.err(value, new Error(`${value} is greater than upper bound ${this._upperBound}`))
    }

    return this.ok(value, num)
  }

  lowerBound (bound: number): NumberArgument {
    this._lowerBound = bound
    return this
  }

  upperBound (bound: number): NumberArgument {
    this._upperBound = bound
    return this
  }

  inRange (lowerBound: number, upperBound: number): NumberArgument {
    this._lowerBound = lowerBound
    this._upperBound = upperBound
    return this
  }
}

class BooleanArgument extends Argument<boolean> {
  constructor () {
    super('boolean')
    super._specifiedDefault = true
    super._unspecifiedDefault = false
    super._optional = true
  }

  async coerce (value: string): Promise<CoercionResult<boolean>> {
    if (!(value === 'true' || value === 'false')) {
      return this.err(value, new Error(`'${value}' is not a boolean`))
    }

    return this.ok(value, value === 'true')
  }
}

class EnumArgument<T extends readonly string[]> extends Argument<T[number]> {
  constructor (private readonly validValues: T) {
    super('enum')
  }

  async coerce (value: string): Promise<CoercionResult<T[number]>> {
    if (!this.validValues.includes(value)) {
      return this.err(value, new Error(`value must be one of '${this.validValues.join(', ')}' got '${value}'`))
    }

    return this.ok(value, value)
  }
}

// Explicitly typed generics because the inference would not cooperate
export const string = makeExport<StringArgument, typeof StringArgument>(StringArgument)
export const number = makeExport<NumberArgument, typeof NumberArgument>(NumberArgument)
export const bool = makeExport<BooleanArgument, typeof BooleanArgument>(BooleanArgument)

class CustomArgument<T> extends Argument<T> {
  constructor (private readonly cb: (value: string) => CoercionResult<T> | Promise<CoercionResult<T>>) {
    super('custom')
  }

  public async coerce (value: string): Promise<CoercionResult<T>> {
    // User passed no callback
    if (!this.cb) {
      return this.err(value, new Error('callback was not provided'))
    }

    return await this.cb(value)
  }
}

// Needs special treatment to handle the generic
export const custom = <T> (...args: ConstructorParameters<typeof CustomArgument<T>>): CustomArgument<T> => {
  return new CustomArgument<T>(...args)
}

export const oneOf = <T extends readonly string[]> (...args: ConstructorParameters<typeof EnumArgument<T>>): EnumArgument<T> => {
  return new EnumArgument<T>(...args)
}
