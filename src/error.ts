export class ArgError extends Error {}
export class ParseError extends ArgError {}
export class CoercionError extends ArgError {}
export class CommandError extends ArgError {}

export class InternalError extends Error {}
