import { Args } from '../args'

export type ArgType<ArgObject, Default = never> = ArgObject extends Args<infer TArgs> ? TArgs : Default
