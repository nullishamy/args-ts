import { Args } from '../../args'
import { Command, MinimalArgument } from '../../builder'
import { IdentToken, ValueToken } from './lexer'

interface ArgumentBase {
  inner: MinimalArgument<CoercedValue>
}

export interface InternalFlagArgument extends ArgumentBase {
  type: 'flag'
  isPrimary: boolean
  longFlag: string
  shortFlag: string | undefined
}

export interface InternalPositionalArgument extends ArgumentBase {
  type: 'positional'
  key: string
  index: number
}

export type InternalArgument = InternalFlagArgument | InternalPositionalArgument

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
