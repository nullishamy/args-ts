import { Argument } from './builder'

export interface ParserOpts {
  name: string
  description: string
  unknownArgBehaviour: 'skip' | 'throw'
}

export type ArgumentType = 'boolean' | 'string' | 'number' | 'custom'
export type ArgumentTypeTable<T extends ArgumentType, TRet = never> = {
  'boolean': boolean
  'string': string
  'number': number
  'custom': TRet
}[T]

export interface WrappedDeclaration {
  inner: Argument<any>
  longFlag: string
  shortFlag: string | undefined
}
