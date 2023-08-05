import { Args } from '../../args'
import { Command, MinimalArgument } from '../../builder'

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
  name: string
  aliases: string[]
  inner: Command
  parser: Args<unknown>
}

export interface ParsedPair {
  ident: string
  values: string[]
}

export interface RuntimeValue {
  pair: ParsedPair | undefined
  argument: InternalArgument
  parsed: unknown[]
}

export type CoercedValue = string | boolean | number | undefined | object
