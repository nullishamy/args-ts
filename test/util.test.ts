/* eslint-disable @typescript-eslint/quotes */
import { Args, Command, ParserOpts, a, util } from '../src'
import { parserOpts } from './shared'

describe('Argv utils', () => {
  it('can extract the arguments', () => {
    const argv = [
      '/bin/node',
      'file-name',
      '--test',
      'value'
    ]

    const result = util.makeArgs(argv)
    expect(result).toStrictEqual([
      '--test',
      'value'
    ])
  })

  it('can extract the file name', () => {
    const argv = [
      '/bin/node',
      'file-name',
      '--test',
      'value'
    ]

    const result = util.fileName(argv)
    expect(result).toStrictEqual('file-name')
  })

  interface ElectronProcess extends NodeJS.Process {
    defaultApp?: boolean
    versions: NodeJS.ProcessVersions & {
      electron: string
    }
  }

  it('can extract the electron file name for bundled apps', () => {
    (process as ElectronProcess).versions.electron = '1.0.0';
    (process as ElectronProcess).defaultApp = false

    const argv = [
      'file-name',
      '--test',
      'value'
    ]

    const result = util.fileName(argv)
    expect(result).toStrictEqual('file-name')
  })

  it('can extract the electron file name for non bundled apps', () => {
    (process as ElectronProcess).versions.electron = '1.0.0';
    (process as ElectronProcess).defaultApp = true

    const argv = [
      'electron',
      'file-name',
      '--test',
      'value'
    ]

    const result = util.fileName(argv)
    expect(result).toStrictEqual('file-name')
  })

  it('can extract the argv for bundled apps', () => {
    (process as ElectronProcess).versions.electron = '1.0.0';
    (process as ElectronProcess).defaultApp = false

    const argv = [
      'file-name',
      '--test',
      'value'
    ]

    const result = util.makeArgs(argv)
    expect(result).toStrictEqual([
      '--test',
      'value'
    ])
  })

  it('can extract the electron file name for non bundled apps', () => {
    (process as ElectronProcess).versions.electron = '1.0.0';
    (process as ElectronProcess).defaultApp = true

    const argv = [
      'electron',
      'file-name',
      '--test',
      'value'
    ]

    const result = util.makeArgs(argv)
    expect(result).toStrictEqual([
      '--test',
      'value'
    ])
  })
})

class HelpCommand extends Command {
  constructor (opts: ParserOpts) {
    super({
      description: 'help',
      parserOpts: opts
    })
  }

  run = this.runner(async (args) => {
  })

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  args = (parser: Args<{}>) =>
    parser.arg(['--cmd-arg'], a.string())
}

describe('Help generation utils', () => {
  it('can generate help for parsers', () => {
    const parser = new Args(parserOpts)
      .arg(['--flag', '-f'], a.string().optional())
      .arg(['--opt-multi', '-o'], a.string().array().optional())
      .arg(['--opt-req', '-r'], a.string().array())
      .arg(['--enum', '-e'], a.oneOf('a', 'b', 'c'))
      .arg(['--long'], a.number())
      .arg(['--long-optional'], a.number().optional())
      .positional('<positionalreq>', a.string())
      .positional('<positional>', a.string().optional())
      .positional('<posmulti>', a.number().array())
      .command(['help', 'nohelp'], new HelpCommand(parserOpts))

    expect(util.generateHelp(parser)).toMatchInlineSnapshot(`
"program-name  - program description 

Usage: program-name [--flag | -f <string>] [--opt-multi | -o <string...>] (--opt-req | -r <string...>) (--enum | -e <a | b | c>) (--long <number>) [--long-optional <number>] <POSITIONALREQ> [<POSITIONAL>] <POSMULTI...>

Commands:
program-name [help, nohelp] (--cmd-arg <string>)

Builtins:
None"
`)
  })
})
