import { Args } from '../args'
import { chunkArray } from '../internal/util'

/**
 * Generate a help string from a parser schema.
 * @see Args#help
 * @param parser - the parser schema to generate from
 * @returns the generated help string
 */
export function generateHelp (parser: Args<{}>): string {
  const { headerLines, commandsList, argumentsList } = parser._state
  const { opts } = parser

  const header = `${opts.programName} - ${opts.programDescription} [version ${opts.programVersion}]`
  const usageOptions = chunkArray(
    5,
    argumentsList.map((a) => {
      if (a.type === 'flag') {
        return `[--${a.longFlag} <${a.inner.type}>]`
      }
      return `<${a.key}>`
    })
  )
    .map((a) => a.join('  '))
    .join('\n')

  const usage = `${opts.programName} ${usageOptions}`
  const flags = argumentsList
    .filter((a) => a.type === 'flag')
    .map((a) => {
      if (a.type !== 'flag') throw new TypeError()

      const { description } = a.inner._state
      let flagValues

      if (a.aliases.length) {
        const values = a.aliases.map((a) => {
          if (a.type === 'long') {
            return `--${a.value}`
          } else {
            return `-${a.value}`
          }
        })

        values.push(`--${a.longFlag}`)

        flagValues = values.join(', ')
      } else {
        flagValues = `--${a.longFlag}`
      }

      return `\t${flagValues} ... ${description ?? a.inner.type}${
        a.inner._state.optional ? ' (optional)' : ''
      }`
    })
    .join('\n')

  const positionals = argumentsList
    .filter((a) => a.type === 'positional')
    .map((a) => {
      if (a.type !== 'positional') throw new TypeError()

      const { description } = a.inner._state
      return `\t<${a.key}> ... ${description ?? a.inner.type}${
        a.inner._state.optional ? ' (optional)' : ''
      }`
    })
    .join('\n')

  const commands = commandsList
    .filter((c) => !c.inner.opts.hidden && c.isBase)
    .map((c) => {
      if (c.aliases.length) {
        return `\t[${[c.name, ...c.aliases].join(', ')}] - ${
          c.inner.opts.description
        }`
      }

      return `\t${c.name} - ${c.inner.opts.description}`
    })
    .join('\n')

  return `
${header}
${headerLines.join('\n')}
USAGE:
${usage}

OPTIONS
${flags}

${positionals}

COMMANDS
${commands}
`.trim()
}
