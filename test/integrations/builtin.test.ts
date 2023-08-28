/* eslint-disable @typescript-eslint/quotes */
import { Args, a, builtin } from '../../src'
import { shellCompletion } from '../../src/util'
import { parserOpts } from '../shared'
import { runBuiltinExecution } from './utils'

describe('Builtin tests', () => {
  it('runs the help builtin from the flag', async () => {
    const mockConsole = jest.spyOn(console, 'log').mockImplementation(() => {})

    const parser = new Args(parserOpts)
      .builtin(builtin.help())
      .arg(['--arg'], a.string().optional())
      .arg(['--number'], a.decimal())

    await runBuiltinExecution(parser, '--help')

    expect(mockConsole).toHaveBeenCalled()
    expect(mockConsole).toHaveBeenCalledWith(parser.help())
  })

  it('runs the help builtin from the command', async () => {
    const mockConsole = jest.spyOn(console, 'log').mockImplementation(() => {})

    const parser = new Args(parserOpts)
      .builtin(builtin.help())
      .arg(['--arg'], a.string().optional())
      .arg(['--number'], a.decimal())

    await runBuiltinExecution(parser, 'help')

    expect(mockConsole).toHaveBeenCalled()
    expect(mockConsole).toHaveBeenCalledWith(parser.help())
  })

  it('runs the version builtin from the flag', async () => {
    const mockConsole = jest.spyOn(console, 'log').mockImplementation(() => {})

    const parser = new Args(parserOpts)
      .builtin(builtin.version())
      .arg(['--arg'], a.string().optional())
      .arg(['--number'], a.decimal())

    await runBuiltinExecution(parser, '--version')

    expect(mockConsole).toHaveBeenCalledWith('program-name (v1)')
  })

  it('runs the completion builtin from the command', async () => {
    const mockConsole = jest.spyOn(console, 'log').mockImplementation(() => {})

    const parser = new Args(parserOpts)
      .builtin(builtin.completions())
      .arg(['--arg'], a.string().optional())
      .arg(['--number'], a.decimal())

    await runBuiltinExecution(parser, 'completion zsh')

    expect(mockConsole).toHaveBeenCalled()
    expect(mockConsole).toHaveBeenCalledWith(shellCompletion('zsh', parser))
  })

  it('rejects command defintions if they conflict with builtins', async () => {
    const parser = new Args(parserOpts)
      .builtin(builtin.completions())
      .arg(['--arg'], a.string().optional())
      .arg(['--number'], a.decimal())

    const result = expect(() => parser.command(['completion'], undefined as any))
    result.toThrowErrorMatchingInlineSnapshot(`"command 'completion' conflicts with builtin 'shell-completion' (ShellCompletion)"`)
  })

  it('rejects command defintions if an alias conflicts with builtins', async () => {
    const parser = new Args(parserOpts)
      .builtin(builtin.completions())
      .arg(['--arg'], a.string().optional())
      .arg(['--number'], a.decimal())

    const result = expect(() => parser.command(['normal', 'completion'], undefined as any))
    result.toThrowErrorMatchingInlineSnapshot(`"command 'normal' conflicts with builtin 'shell-completion' (ShellCompletion)"`)
  })
})
