import { Argument, ParseResult } from '.'
import { ParseError } from '../error'

function makeExport <T, TConst extends new (...args: any[]) => T> (ArgClass: TConst): (...args: ConstructorParameters<TConst>) => T {
  return (...args: any[]) => new ArgClass(...args)
}

export class StringArgument extends Argument<string> {
  constructor () {
    super('string')
  }

  parse (value: string): ParseResult<string> {
    return {
      ok: true,
      passedValue: value,
      returnedValue: value
    }
  }
}

export class NumberArgument extends Argument<number> {
  private _lowerBound: number | undefined = undefined
  private _upperBound: number | undefined = undefined

  constructor () {
    super('number')
  }

  parse (value: string): ParseResult<number> {
    const num = parseInt(value, 10)
    if (isNaN(num)) {
      return {
        ok: false,
        passedValue: value,
        error: new ParseError(`'${value}' is not a number`)
      }
    }

    if (this._lowerBound && num < this._lowerBound) {
      return {
        ok: false,
        passedValue: value,
        error: new ParseError(`'${value}' is less than lower bound ${this._lowerBound}`)
      }
    }
    if (this._upperBound && num > this._upperBound) {
      return {
        ok: false,
        passedValue: value,
        error: new ParseError(`'${value}' is greater than upper bound ${this._upperBound}`)
      }
    }

    return {
      ok: true,
      passedValue: value,
      returnedValue: num
    }
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

export class BooleanArgument extends Argument<boolean> {
  constructor () {
    super('boolean')
    // Booleans default to true (ie unspecified argument) unless specified otherwise
    super._default = true
  }

  parse (value: string): ParseResult<boolean> {
    if (!(value === 'true' || value === 'false')) {
      return {
        ok: false,
        passedValue: value,
        error: new ParseError(`'${value}' is not a boolean`)
      }
    }

    return {
      ok: true,
      passedValue: value,
      returnedValue: value === 'true'
    }
  }
}

// Explicitly typed generices because the inference would not cooperate
export const String = makeExport<StringArgument, typeof StringArgument>(StringArgument)
export const Number = makeExport<NumberArgument, typeof NumberArgument>(NumberArgument)
export const Boolean = makeExport<BooleanArgument, typeof BooleanArgument>(BooleanArgument)

export class CustomArgument<T> extends Argument<T> {
  constructor (private readonly cb: (value: string) => ParseResult<T> | Promise<ParseResult<T>>) {
    super('custom')
  }

  public parse (value: string): ParseResult<T> | Promise<ParseResult<T>> {
    // User passed no callback
    if (!this.cb) {
      return {
        ok: false,
        passedValue: value,
        error: new ParseError('callback was not provided')
      }
    }
    return this.cb(value)
  }
}
// Needs special treatment to handle the generic
export const Custom = <T> (...args: ConstructorParameters<typeof CustomArgument<T>>): CustomArgument<T> => {
  return new CustomArgument<T>(...args)
}