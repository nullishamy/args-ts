/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/quotes */
import assert from 'assert'
import { a, Args, Command, CommandOpts, ParserOpts } from '../../src'
import { parserOpts } from '../shared'
import { runCommandExecution } from './utils'

class MockCommand extends Command {
  constructor (
    parserOpts: ParserOpts,
    commandOpts: Partial<CommandOpts>,
    public readonly id: string,
    public readonly parserFn: (parser: Args<unknown>) => Args<unknown> = jest.fn(p => p),
    public readonly executionFn: (args: object) => unknown = jest.fn()
  ) {
    super({
      ...commandOpts,
      description: 'mock command',
      parserOpts
    })
  }

  withSubcommand ([name, ...aliases]: string[], cmd: Command): this {
    this.subcommand([name, ...aliases], cmd)
    return this
  }

  run = this.runner(async (args) => this.executionFn(args))
  args = (parser: Args<unknown>) => this.parserFn(parser)
}

describe('Command testing', () => {
  it('can run root commands', async () => {
    const cmd = new MockCommand(parserOpts, {}, 'root')
    const parser = new Args(parserOpts)
      .command(['root'], cmd)

    const result = await runCommandExecution(parser, 'root')

    expect(result).toBe(undefined)
    expect(cmd.executionFn).toBeCalledTimes(1)
    expect(cmd.parserFn).toBeCalledTimes(1)
  })

  it('rejects when no command is passed', async () => {
    const cmd = new MockCommand(parserOpts, {}, 'root')
    const parser = new Args(parserOpts)
      .command(['root'], cmd)

    const result = expect(async () => await runCommandExecution(parser, '')).rejects
    await result.toMatchInlineSnapshot(`[Error: no command provided but one was expected]`)
  })

  it('passes when commands are not required', async () => {
    const cmd = new MockCommand(parserOpts, {}, 'root')
    const parser = new Args({
      ...parserOpts,
      mustProvideCommand: false
    })
      .command(['root'], cmd)

    const result = await parser.parseToResult('')

    assert(result.ok)
    assert(result.val.mode === 'args')
    expect(result.val.args).toStrictEqual({})
  })

  it('rejects duplicate command names', () => {
    const cmd = new MockCommand(parserOpts, {}, 'root')
    const parser = new Args(parserOpts)
      .command(['root'], cmd)

    const result = expect(() => parser.command(['root'], cmd))
    result.toThrowErrorMatchingInlineSnapshot(`"command 'root' already declared"`)
  })

  it('rejects duplicate command aliases', () => {
    const cmd = new MockCommand(parserOpts, {}, 'root')
    const parser = new Args(parserOpts)
      .command(['root'], cmd)

    const result = expect(() => parser.command(['notroot', 'root'], cmd))
    result.toThrowErrorMatchingInlineSnapshot(`"command alias 'root' already declared"`)
  })

  it('rejects duplicate subcommand names', () => {
    const sub = new MockCommand(parserOpts, {}, 'sub')

    const cmd = new MockCommand(parserOpts, {}, 'root')
      .withSubcommand(['sub'], sub)

    const result = expect(() => cmd.withSubcommand(['sub'], sub))
    result.toThrowErrorMatchingInlineSnapshot(`"subcommand sub already registered"`)
  })

  it('rejects duplicate subcommand aliases', () => {
    const sub = new MockCommand(parserOpts, {}, 'sub')

    const cmd = new MockCommand(parserOpts, {}, 'root')
      .withSubcommand(['sub'], sub)

    const result = expect(() => cmd.withSubcommand(['notsub', 'sub'], sub))
    result.toThrowErrorMatchingInlineSnapshot(`"subcommand alias sub already registered"`)
  })

  it('reports the deprecation message for deprecated commands', async () => {
    const cmd = new MockCommand(parserOpts, {
      deprecated: true,
      deprecationMessage: 'Mock deprecation message'
    }, 'root')

    const parser = new Args(parserOpts)
      .command(['root'], cmd)

    const result = expect(async () => await runCommandExecution(parser, 'root'))
    await result.rejects.toMatchInlineSnapshot(`[Error: Mock deprecation message]`)

    expect(cmd.parserFn).toBeCalledTimes(1)
    expect(cmd.executionFn).toBeCalledTimes(0)
  })

  it('does reports unknown for deprecated commands', async () => {
    const cmd = new MockCommand({
      ...parserOpts,
      deprecatedCommands: 'unknown-command'
    }, {
      deprecated: true,
      deprecationMessage: 'Mock deprecation message'
    }, 'root')

    const parser = new Args(parserOpts)
      .command(['root'], cmd)

    const result = expect(async () => await runCommandExecution(parser, 'root'))
    await result.rejects.toMatchInlineSnapshot(`[Error: unknown command 'root']`)

    expect(cmd.parserFn).toBeCalledTimes(1)
    expect(cmd.executionFn).toBeCalledTimes(0)
  })
  it('can run subcommands', async () => {
    const sub = new MockCommand(parserOpts, {}, 'sub')
    const cmd = new MockCommand(parserOpts, {}, 'root')
      .withSubcommand(['sub'], sub)

    const parser = new Args(parserOpts)
      .command(['root'], cmd)

    const result = await runCommandExecution(parser, 'root sub')

    expect(result).toBe(undefined)
    expect(cmd.executionFn).toBeCalledTimes(0)
    expect(cmd.parserFn).toBeCalledTimes(1)

    expect(sub.executionFn).toBeCalledTimes(1)
    expect(sub.parserFn).toBeCalledTimes(1)
  })

  it('can run third layer subcommands', async () => {
    const subsub = new MockCommand(parserOpts, {}, 'subsub')
    const sub = new MockCommand(parserOpts, {}, 'sub')
      .withSubcommand(['subsub'], subsub)

    const cmd = new MockCommand(parserOpts, {}, 'root')
      .withSubcommand(['sub'], sub)

    const parser = new Args(parserOpts)
      .command(['root'], cmd)

    const result = await runCommandExecution(parser, 'root sub subsub')

    expect(result).toBe(undefined)
    expect(cmd.executionFn).toBeCalledTimes(0)
    expect(cmd.parserFn).toBeCalledTimes(1)

    expect(sub.executionFn).toBeCalledTimes(0)
    expect(sub.parserFn).toBeCalledTimes(1)

    expect(subsub.executionFn).toBeCalledTimes(1)
    expect(subsub.parserFn).toBeCalledTimes(1)
  })

  it('allows quoted command keys', async () => {
    const cmd = new MockCommand(parserOpts, {}, 'root')

    const parser = new Args(parserOpts)
      .command(['root'], cmd)

    const result = await runCommandExecution(parser, '"root"')

    expect(result).toBe(undefined)
    expect(cmd.executionFn).toBeCalledTimes(1)
    expect(cmd.parserFn).toBeCalledTimes(1)
  })

  it('allows quoted subcommand keys', async () => {
    const sub = new MockCommand(parserOpts, {}, 'sub')
    const cmd = new MockCommand(parserOpts, {}, 'root')
      .withSubcommand(['sub', 'sub-alias'], sub)

    const parser = new Args(parserOpts)
      .command(['root'], cmd)

    const result = await runCommandExecution(parser, 'root "sub-alias"')

    expect(result).toBe(undefined)
    expect(cmd.executionFn).toBeCalledTimes(0)
    expect(cmd.parserFn).toBeCalledTimes(1)

    expect(sub.executionFn).toBeCalledTimes(1)
    expect(sub.parserFn).toBeCalledTimes(1)
  })

  it('can run subcommand through an alias', async () => {
    const sub = new MockCommand(parserOpts, {}, 'sub')
    const cmd = new MockCommand(parserOpts, {}, 'root')
      .withSubcommand(['sub', 'alias'], sub)

    const parser = new Args(parserOpts)
      .command(['root'], cmd)

    const result = await runCommandExecution(parser, 'root alias')

    expect(result).toBe(undefined)
    expect(cmd.executionFn).toBeCalledTimes(0)
    expect(cmd.parserFn).toBeCalledTimes(1)

    expect(sub.executionFn).toBeCalledTimes(1)
    expect(sub.parserFn).toBeCalledTimes(1)
  })

  it('can run a command through an alias', async () => {
    const cmd = new MockCommand(parserOpts, {}, 'root')

    const parser = new Args(parserOpts)
      .command(['root', 'notroot'], cmd)

    const result = await runCommandExecution(parser, 'notroot')

    expect(result).toBe(undefined)
    expect(cmd.executionFn).toBeCalledTimes(1)
    expect(cmd.parserFn).toBeCalledTimes(1)
  })

  it('can run subcommand with sub specific args', async () => {
    const parserFn = jest.fn<Args, [Args<unknown>]>(parser => {
      return parser
        .arg(['--sub-arg'], a.string())
    })

    const sub = new MockCommand(parserOpts, {}, 'sub', parserFn)
    const cmd = new MockCommand(parserOpts, {}, 'root')
      .withSubcommand(['sub'], sub)

    const parser = new Args(parserOpts)
      .command(['root'], cmd)

    const result = await runCommandExecution(parser, 'root sub --sub-arg hello')

    expect(result).toBe(undefined)
    expect(cmd.executionFn).toBeCalledTimes(0)
    expect(cmd.parserFn).toBeCalledTimes(1)

    expect(sub.executionFn).toBeCalledTimes(1)
    expect(sub.parserFn).toBeCalledTimes(1)
  })
})
