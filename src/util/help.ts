import { Args } from '../args'
import { InternalArgument } from '../internal/parse/types'

export function generateHelp (parser: Args<unknown>): string {
  const { commands, arguments: parserArguments, opts } = parser

  const renderArgument = (value: InternalArgument): string => {
    if (value.inner._optional) {
      if (value.type === 'positional') {
        return `[<${value.key.toUpperCase()}>]`
      }

      if (value.shortFlag) {
        if (value.inner._isMultiType) {
          return `[--${value.longFlag} | -${value.shortFlag} <${value.inner.type}...>]`
        }
        return `[--${value.longFlag} | -${value.shortFlag} <${value.inner.type}>]`
      }
      return `[--${value.longFlag} <${value.inner.type}>]`
    } else {
      if (value.type === 'positional') {
        if (value.inner._isMultiType) {
          return `<${value.key.toUpperCase()}...>`
        }
        return `<${value.key.toUpperCase()}>`
      }

      if (value.shortFlag) {
        if (value.inner._isMultiType) {
          return `[--${value.longFlag} | -${value.shortFlag} <${value.inner.type}...>]`
        }
        return `(--${value.longFlag} | -${value.shortFlag} <${value.inner.type})`
      }

      return `--${value.longFlag} <${value.inner.type}>`
    }
  }

  // Filter out non primary flag args, but keep all positionals
  const filterPrimary = (arg: InternalArgument): boolean => (arg.type === 'flag' && arg.isPrimary) || arg.type === 'positional'
  const usageString = Object.values(parserArguments).filter(filterPrimary).map(arg => renderArgument(arg)).join(' ')

  const commandString = Object.entries(commands).map(([key, value]) => {
    let nameString = value.name
    if (value.aliases.length) {
      nameString = `[${value.name}, ${value.aliases.join(', ')}]`
    }
    return `${opts.programName} ${nameString} ${Object.values(value.parser.arguments).filter(filterPrimary).map(arg => renderArgument(arg)).join(' ')}`
  }).join('\n')

  return `
${opts.programName} - ${opts.programDescription} ${parser.headerLines.length ? '\n' + parser.headerLines.join('\n') : ''}

Usage: ${opts.programName} ${usageString}

Commands:
${commandString || 'None'}
${parser.footerLines.join('\n')}`.trim()
}
