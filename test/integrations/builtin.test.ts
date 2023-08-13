import { Args, a, builtin } from '../../src'
import { parserOpts } from '../shared'
import { runBuiltinExecution } from './utils'

describe('Builtin tests', () => {
  it('runs the help builtin from the flag', async () => {
    const mockConsole = jest.spyOn(console, 'log').mockImplementation(() => {})

    const parser = new Args(parserOpts)
      .builtin(new builtin.Help())
      .arg(['--arg'], a.string().optional())
      .arg(['--number'], a.decimal())

    await runBuiltinExecution(parser, '--help')

    expect(mockConsole).toHaveBeenCalled()
    expect(mockConsole).toHaveBeenCalledWith(parser.help())
  })

  it('runs the help builtin from the command', async () => {
    const mockConsole = jest.spyOn(console, 'log').mockImplementation(() => {})

    const parser = new Args(parserOpts)
      .builtin(new builtin.Help())
      .arg(['--arg'], a.string().optional())
      .arg(['--number'], a.decimal())

    await runBuiltinExecution(parser, 'help')

    expect(mockConsole).toHaveBeenCalled()
    expect(mockConsole).toHaveBeenCalledWith(parser.help())
  })

  it('runs the version builtin from the flag', async () => {
    const mockConsole = jest.spyOn(console, 'log').mockImplementation(() => {})

    const parser = new Args(parserOpts)
      .builtin(new builtin.Version())
      .arg(['--arg'], a.string().optional())
      .arg(['--number'], a.decimal())

    await runBuiltinExecution(parser, '--version')

    expect(mockConsole).toHaveBeenCalledWith('program-name (v1)')
  })

  it('runs the completion builtin from the command', async () => {
    const mockConsole = jest.spyOn(console, 'log').mockImplementation(() => {})

    const parser = new Args(parserOpts)
      .builtin(new builtin.ShellCompletion())
      .arg(['--arg'], a.string().optional())
      .arg(['--number'], a.decimal())

    await runBuiltinExecution(parser, 'completion zsh fish bash')

    expect(mockConsole).toHaveBeenCalled()
    expect(mockConsole).toHaveBeenCalledWith('Generated completions for zsh')
    expect(mockConsole).toHaveBeenCalledWith('Generated completions for fish')
    expect(mockConsole).toHaveBeenCalledWith('Generated completions for bash')
  })
})
