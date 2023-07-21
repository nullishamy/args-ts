/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { parserOpts, runCommandExecution } from '.'
import { a, Args, Command } from '../src'

class TestCommand extends Command {
  constructor () {
    super({
      description: 'epic foo command',
      parserOpts: {
        unknownArgBehaviour: 'skip'
      }
    })
  }

  args = (parser: Args<unknown>) =>
    parser.add(['--another'], a.string())

  run = this.runner(async (args) => {
    return args.another
  })
}

describe('Command parsing', () => {
  it('parses basic commands', async () => {
    const parser = new Args(parserOpts)
      .command(['test'], new TestCommand())

    const result = await runCommandExecution(parser, 'test --another owo')
    expect(result).toBe('owo')
  })

  it('skips unknown arguments', async () => {
    const parser = new Args(parserOpts)
      .command(['test'], new TestCommand())

    const result = await runCommandExecution(parser, 'test --another owo --unknown-argument-here value')
    expect(result).toBe('owo')
  })
})
