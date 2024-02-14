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
      description: 'shows the help',
      parserOpts: opts
    })
  }

  run = this.runner(async (args) => {
  })

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  args = (parser: Args<{}>) =>
    parser.arg(['--cmd-arg'], a.string())
}

class SingleCommand extends Command {
  constructor (opts: ParserOpts) {
    super({
      description: 'is a single command',
      parserOpts: opts
    })
  }

  run = this.runner(async (args) => {
  })

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  args = (parser: Args<{}>) =>
    parser.arg(['--single-arg'], a.string())
}

describe('Help generation utils', () => {
  it('can generate help for parsers', () => {
    const parser = new Args(parserOpts)
      .arg(['--bool-flag'], a.bool())
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
      .command(['single'], new SingleCommand(parserOpts))

    /* eslint-disable no-tabs */
    expect(util.generateHelp(parser)).toMatchInlineSnapshot(`
"program-name - program description [version v1]

USAGE:
program-name [--bool-flag <boolean>]  [--flag <string>]  [--opt-multi <string>]  [--opt-req <string>]  [--enum <a | b | c>]
[--long <number>]  [--long-optional <number>]  <positionalreq>  <positional>  <posmulti>

OPTIONS
	--bool-flag ... boolean (optional)
	-f, --flag ... string (optional)
	-o, --opt-multi ... string (optional)
	-r, --opt-req ... string
	-e, --enum ... a | b | c
	--long ... number
	--long-optional ... number (optional)

	<positionalreq> ... string
	<positional> ... string (optional)
	<posmulti> ... number

COMMANDS
	[help, nohelp] - shows the help
	single - is a single command"
`)
  })
/* eslint-enable no-tabs */
})
