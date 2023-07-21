/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { runCommandExecution } from '.'
import { a, Args, Command, ParserOpts } from '../src'

describe('Integrations', () => {
  it('can parse a vsc application', async () => {
    // Emulates basic `git` features
    class Clone extends Command {
      constructor (opts: ParserOpts) {
        super({
          description: 'Clone a repository into a new directory',
          parserOpts: opts
        })
      }

      args = (parser: Args<unknown>) => parser
        .add(['--repo'], a.string())
        .add(['--target'], a.string())

      run = this.runner(async args => { })
    }

    const opts: ParserOpts = {
      programName: 'git',
      programDescription: 'VCS',
      excessArgBehaviour: 'throw',
      unknownArgBehaviour: 'throw'
    }

    const parser = new Args(opts)
      .add(['--version', '-v'], a.bool())
      .add(['--help', '-h'], a.bool())
      .command(['clone'], new Clone(opts))

    const result = await runCommandExecution(parser, 'clone --repo "my repo here" --target pwd')
    expect(result).toStrictEqual(undefined)
  })
})
