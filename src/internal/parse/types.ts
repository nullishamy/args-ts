import { Args } from '../../args'
import { Command, MinimalArgument } from '../../builder'

interface ArgumentBase {
  inner: MinimalArgument<CoercedValue>
}

export interface FlagAlias {
  type: 'long' | 'short'
  value: string
}

export interface InternalFlagArgument extends ArgumentBase {
  type: 'flag'
  isLongFlag: boolean
  longFlag: string
  aliases: FlagAlias[]
}

export interface InternalPositionalArgument extends ArgumentBase {
  type: 'positional'
  key: string
  index: number
}

export type InternalArgument = InternalFlagArgument | InternalPositionalArgument

export interface InternalCommand {
  name: string
  isBase: boolean
  aliases: string[]
  inner: Command
  parser: Args<{}>
}

export type CoercedValue = string | boolean | number | undefined | object | bigint
