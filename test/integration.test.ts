/* eslint-disable @typescript-eslint/explicit-function-return-type */
import assert from 'assert'
import { a, Args, Command } from '../src'

describe('Integrations', () => {
  it('can parse a vsc application', async () => {
    // Emulates basic `git` features
    class Clone extends Command {
      constructor () {
        super({
          description: 'Clone a repository into a new directory'
        })
      }

      args = (parser: Args<unknown>) => parser
        .add(['--repo'], a.string())
        .add(['--target'], a.string())

      run = this.runner(async args => { })
    }

    const parser = new Args({
      programName: 'git',
      programDescription: 'VCS',
      excessArgBehaviour: 'throw',
      unknownArgBehaviour: 'throw'
    })
      .add(['--version', '-v'], a.bool())
      .add(['--help', '-h'], a.bool())
      .command(['clone'], new Clone())

    const result = await parser.parse('clone --repo "my repo here" --target pwd')
    assert(result.mode === 'command-exec')

    expect(result.executionResult).toStrictEqual(undefined)
  })
})
