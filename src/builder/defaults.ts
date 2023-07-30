import { Argument, CoercionResult } from '.'
import { CoercionError } from '../error'

function makeExport <T, TConst extends new (...args: any[]) => T> (ArgClass: TConst): (...args: ConstructorParameters<TConst>) => T {
  return (...args: any[]) => new ArgClass(...args)
}

class StringArgument extends Argument<string> {
  constructor () {
    super('string')
  }

  async coerce (value: string): Promise<CoercionResult<string>> {
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
      return this.err(value, new CoercionError(`'${value}' is not a number`))
    }

    if (this._lowerBound && num < this._lowerBound) {
      return this.err(value, new CoercionError(`${value} is less than lower bound ${this._lowerBound}`))
    }

    if (this._upperBound && num > this._upperBound) {
      return this.err(value, new CoercionError(`${value} is greater than upper bound ${this._upperBound}`))
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
    // Booleans default to true (ie unspecified argument) unless specified otherwise
    super._default = true
  }

  async coerce (value: string): Promise<CoercionResult<boolean>> {
    if (!(value === 'true' || value === 'false')) {
      return this.err(value, new CoercionError(`'${value}' is not a boolean`))
    }

    return this.ok(value, value === 'true')
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
      return this.err(value, new CoercionError('callback was not provided'))
    }

    return await this.cb(value)
  }
}
// Needs special treatment to handle the generic
export const custom = <T> (...args: ConstructorParameters<typeof CustomArgument<T>>): CustomArgument<T> => {
  return new CustomArgument<T>(...args)
}
