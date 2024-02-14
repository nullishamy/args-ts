import { InternalError, SchemaError } from '../error'
import { FlagAlias, InternalArgument } from './parse/types'

export function getArgDenotion (argument: InternalArgument): string {
  if (argument.type === 'flag') {
    return `--${argument.longFlag}`
  } else {
    return `<${argument.key}>`
  }
}

export function getAliasDenotion (alias: FlagAlias): string {
  if (alias.type === 'long') {
    return `--${alias.value}`
  } else {
    return `-${alias.value}`
  }
}

const flagValidationRegex = /-+(?:[a-z]+)/

export function internaliseFlagString (flag: string): ['long' | 'short', string] {
  if (!flagValidationRegex.test(flag)) {
    throw new SchemaError(`flags must match '--abcdef...' or '-abcdef' got '${flag}'`)
  }

  // Long flag
  if (flag.startsWith('--')) {
    return ['long', flag.substring(2)]
  }

  if (flag.startsWith('-')) {
    return ['short', flag.substring(1)]
  }

  throw new InternalError('impossible')
}

export function chunkArray<T> (perChunk: number, array: T[]): T[][] {
  const result = array.reduce<T[][]>((resultArray, item, index) => {
    const chunkIndex = Math.floor(index / perChunk)

    if (!resultArray[chunkIndex]) {
      resultArray[chunkIndex] = [] // start a new chunk
    }

    resultArray[chunkIndex].push(item)

    return resultArray
  }, [])
  return result
}
