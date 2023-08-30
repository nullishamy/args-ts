/**
 * The base error class for any error the library produces under normal operation.
 */
export class ArgError extends Error {
  format (): string {
    return this.message
  }
}

/**
 * The error produced when the parser encounters a problem.
 */
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

/**
 * The error produced when an argument fails to convert from the raw string format to its required format, as specified by the schema.
 */
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
/**
 * The error produced when a problem is encountered by a command.
 */
export class CommandError extends ArgError {}
/**
 * The error produced when a problem is encountered by schema validation.
 * @see Args.validate
 */
export class SchemaError extends ArgError {}

/**
 * The error produced when the library encounters invalid assertions. If you get this error, please file a bug!
 *
 * Does not extend from {@link ArgError} because it should be left uncaught, as it signifies an internal problem,
 * which should never occur during normal operation
 */
export class InternalError extends Error {}
