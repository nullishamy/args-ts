import { InternalArgument } from './parse/types'

export function getArgDenotion (argument: InternalArgument): string {
  if (argument.type === 'flag') {
    return `--${argument.longFlag}`
  } else {
    return `<${argument.key}>`
  }
}
