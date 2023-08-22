import { Args, a } from '../../src'
import { parserOpts } from '../shared'
import { readFile } from 'fs/promises'
import { CoercionError, ParseError } from '../../src/error'
import path from 'path'

describe('Edge cases', () => {
  const parser = new Args(parserOpts)
    .arg(['--non-latin'], a.string())

  // https://github.com/minimaxir/big-list-of-naughty-strings/blob/master/blns.json
  it('can parse the naughty strings', async () => {
    const strings: string[] = JSON.parse(
      await readFile(
        path.join(__dirname, 'naughty-strings.json'),
        { encoding: 'utf-8' }
      )
    )

    const warnings: Error[] = []
    for (const naughty of strings) {
      let result: Awaited<ReturnType<typeof parser['parseToResult']>>

      try {
        // Try various string formations to induce errors
        await parser.parseToResult(`--non-latin ${naughty}`)
        await parser.parseToResult(`--non-latin '${naughty}'`)
        result = await parser.parseToResult(`--non-latin "${naughty}"`)
      } catch (err) {
        throw new Error(`error when parsing '${naughty}':\n${(err as Error).stack}`)
      }

      // "errors" are acceptable here, so long as the parser does not throw
      // log them so that we can spot strange messages
      if (!result.ok) {
        if (Array.isArray(result.err)) {
          result.err.forEach(e => warnings.push(e))
          continue
        }

        warnings.push(result.err)
        continue
      }

      if (result.val.mode !== 'args') {
        throw new Error(`result was not args, got ${result.val.mode} for '${naughty}'`)
      }

      expect(result.val.args['non-latin']).toStrictEqual(naughty)
    }

    let warnLog = ''
    for (const warning of warnings) {
      if (warning instanceof CoercionError) {
        warnLog += `coercion: ${warning.problem}`
      } else if (warning instanceof ParseError) {
        warnLog += `parse: ${warning.problem}`
      } else {
        warnLog += `unknown error: ${warning.message}`
      }

      warnLog += '\n'
    }

    // We will want to inspect any changes to our logs, in case we accidentally broke something
    // but we won't want to do it ourselves, have jest do the diffing and updating for us.
    expect(warnLog).toMatchSnapshot()
  })
})
