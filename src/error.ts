export class ArgError extends Error {
  format (): string {
    return this.message
  }
}

export class ParseError extends ArgError {
  static expected (expected: string, received: string, argString: string, index: number): ParseError {
    return new ParseError(`expected: ${expected} -- received: ${received}`, argString, index)
  }

  constructor (
    public readonly problem: string,
    public readonly argString: string,
    public readonly index: number
  ) {
    super(`${problem} @ ${index} : ${argString}`)
  }

  format (): string {
    return this.problem
  }
}

export class CoercionError extends ArgError {
  constructor (
    public readonly expectedType: string,
    public readonly receivedValue: string,
    public readonly problem: string,
    public readonly argument: string
  ) {
    super(`${problem}, expected '${expectedType}' received '${receivedValue}' @ ${argument}`)
  }

  format (): string {
    return `argument: ${this.argument}\nexpected: ${this.expectedType}\nrecieved: ${this.receivedValue}\ninfo: ${this.problem}`
  }
}
export class CommandError extends ArgError {}
export class SchemaError extends ArgError {}

export class InternalError extends Error {}
