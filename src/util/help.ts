import { Args } from '../args'
import { InternalArgument } from '../internal/parse/types'

/**
 * Generate a help string from a parser schema.
 * @see Args#help
 * @param parser - the parser schema to generate from
 * @returns the generated help string
 */
export function generateHelp (parser: Args<unknown>): string {
  const { commands, arguments: parserArguments, opts } = parser

  const renderArgument = (value: InternalArgument): string => {
    const { optional, isMultiType } = value.inner._meta
    if (optional) {
      if (value.type === 'positional') {
        return `[<${value.key.toUpperCase()}>]`
      }

      if (value.shortFlag) {
        if (isMultiType) {
          return `[--${value.longFlag} | -${value.shortFlag} <${value.inner.type}...>]`
        }
        return `[--${value.longFlag} | -${value.shortFlag} <${value.inner.type}>]`
      }
      return `[--${value.longFlag} <${value.inner.type}>]`
    } else {
      if (value.type === 'positional') {
        if (isMultiType) {
          return `<${value.key.toUpperCase()}...>`
        }
        return `<${value.key.toUpperCase()}>`
      }

      if (value.shortFlag) {
        if (isMultiType) {
          return `(--${value.longFlag} | -${value.shortFlag} <${value.inner.type}...>)`
        }
        return `(--${value.longFlag} | -${value.shortFlag} <${value.inner.type}>)`
      }

      return `(--${value.longFlag} <${value.inner.type}>)`
    }
  }

  // Filter out non primary flag args, but keep all positionals
  const filterPrimary = (arg: InternalArgument): boolean => (arg.type === 'flag' && arg.isLongFlag) || arg.type === 'positional'
  const usageString = parserArguments.values().filter(filterPrimary).map(arg => renderArgument(arg)).join(' ')

  const commandString = commands.entries()
    .filter(([,v]) => !v.inner.opts.hidden && v.isBase)
    .map(([,cmd]) => {
      let nameString = cmd.name
      if (cmd.aliases.length) {
        nameString = `[${cmd.name}, ${cmd.aliases.join(', ')}]`
      }
      return `${opts.programName} ${nameString} ${cmd.parser.arguments.values().filter(filterPrimary).map(arg => renderArgument(arg)).join(' ')}`
    }).join('\n')

  return `
${opts.programName} ${opts.programDescription && ` - ${opts.programDescription}`} ${parser.headerLines.length ? '\n' + parser.headerLines.join('\n') : ''}

Usage: ${opts.programName} ${usageString}

Commands:
${commandString || 'None'}
${parser.footerLines.join('\n')}`.trim()
}
