/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { parserOpts, runCommandExecution } from '.'
import { a, Args, Command, ParserOpts } from '../src'

class BaseCommand extends Command {
  constructor (opts: ParserOpts) {
    super({
      description: 'base command',
      parserOpts: {
        ...opts,
        unknownArgBehaviour: 'skip'
      }
    })
  }

  args = (parser: Args<unknown>) =>
    parser.add(['--passed'], a.string())

  run = this.runner(async (args) => {
    return args.passed
  })
}

class SubCommandHolder extends Command {
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
    parser.add(['--passed'], a.string())

  run = this.runner(async (args) => {
    return args.passed
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

  args = (parser: Args<unknown>) =>
    parser.add(['--test'], a.string())

  run = this.runner(async (args) => {
    return `sub ${args.test}`
  })
}

describe('Command parsing', () => {
  it('parses basic commands', async () => {
    const parser = new Args(parserOpts)
      .command(['test'], new BaseCommand(parserOpts))

    const result = await runCommandExecution(parser, 'test --passed owo')
    expect(result).toBe('owo')
  })

  it('skips unknown arguments', async () => {
    const parser = new Args(parserOpts)
      .command(['test'], new BaseCommand(parserOpts))

    const result = await runCommandExecution(parser, 'test --passed owo --unknown-argument-here value')
    expect(result).toBe('owo')
  })

  it('supports subcommands', async () => {
    const parser = new Args(parserOpts)
      .command(['test'], new SubCommandHolder(parserOpts))

    const result = await runCommandExecution(parser, 'test sub-alias --test epic')
    expect(result).toBe('sub epic')
  })
})
