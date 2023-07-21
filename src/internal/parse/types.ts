import { Args } from '../../args'
import { Argument, Command } from '../../builder'
import { IdentToken, ValueToken } from './lexer'

export interface InternalArgument {
  inner: Argument<CoercedValue>
  longFlag: string
  shortFlag: string | undefined
}

export interface InternalCommand {
  inner: Command
  name: string
  parser: Args<unknown>
  aliases: string[]
}

export interface ParsedPair {
  ident: IdentToken
  values: ValueToken[]
}

export interface RuntimeValue {
  pair: ParsedPair | undefined
  argument: InternalArgument
  parsed: unknown[]
}

export type CoercedValue = string | boolean | number | undefined | object
