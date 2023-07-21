import { Args } from '../args'

export type ExtractArgType<ArgObject, Default = never> = ArgObject extends Args<infer TArgs> ? TArgs : Default
