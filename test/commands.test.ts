/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { parserOpts, runCommandExecution } from '.'
import { a, Args, Command, ParserOpts } from '../src'

class TestCommand extends Command {
  constructor (opts: ParserOpts) {
    super({
      description: 'epic foo command',
      parserOpts: {
        ...opts,
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

class Subcommand extends Command {
  constructor (opts: ParserOpts) {
    super({
      description: 'epic foo subcommand',
      parserOpts: {
        ...opts,
        unknownArgBehaviour: 'skip'
      }
    })
  }

  args = (parser: Args<unknown>) => parser
  run = this.runner(async (args) => {
    return 'sub'
  })
}

class WithSubcommands extends Command {
  constructor (opts: ParserOpts) {
    super({
      description: 'epic foo command',
      parserOpts: {
        ...opts,
        unknownArgBehaviour: 'skip'
      }
    })

    this.subcommand(['sub', 'sub-alias'], new Subcommand(opts))
  }

  args = (parser: Args<unknown>) =>
    parser.add(['--another'], a.string())

  run = this.runner(async (args) => {
    return 'parent'
  })

  subcommands = {
    sub: new Subcommand(this.opts.parserOpts)
  }
}

describe('Command parsing', () => {
  it('parses basic commands', async () => {
    const parser = new Args(parserOpts)
      .command(['test'], new TestCommand(parserOpts))

    const result = await runCommandExecution(parser, 'test --another owo')
    expect(result).toBe('owo')
  })

  it('skips unknown arguments', async () => {
    const parser = new Args(parserOpts)
      .command(['test'], new TestCommand(parserOpts))

    const result = await runCommandExecution(parser, 'test --another owo --unknown-argument-here value')
    expect(result).toBe('owo')
  })

  it('supports subcommands', async () => {
    const parser = new Args(parserOpts)
      .command(['test'], new WithSubcommands(parserOpts))

    const result = await runCommandExecution(parser, 'test sub-alias')
    expect(result).toBe('sub')
  })
})
