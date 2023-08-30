import { Args } from '../args'

/**
 * Extracts the inner type from a parser, or the Default.
 * Used to easily pass around the output interface from a parser, as well as internally for callback typing.
 */
export type ArgType<ArgObject, Default = never> = ArgObject extends Args<infer TArgs> ? TArgs : Default
