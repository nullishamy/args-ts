import { usePlatform, nodePlatform } from './internal/platform'

export * from './args'
export * from './builder'
export * from './opts'
export * as util from './util'

usePlatform(nodePlatform)
