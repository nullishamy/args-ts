export class ArgError extends Error {}

export class ParseError extends ArgError {
  static expected (expected: string, received: string, argString: string, index: number): ParseError {
    return new ParseError(`expected: ${expected}\nreceived: ${received}`, argString, index)
  }

  constructor (
    public readonly problem: string,
    public readonly argString: string,
    public readonly index: number
  ) {
    super(`${problem} @ ${index} : ${argString}`)
  }
}

export class CoercionError extends ArgError {
  constructor (
    public readonly expectedType: string,
    public readonly receivedValue: string,
    public readonly problem: string
  ) {
    super(`${problem}, expected '${expectedType}' received '${receivedValue}'`)
  }
}
export class CommandError extends ArgError {}
export class SchemaError extends ArgError {}

export class InternalError extends Error {}
