import { Args } from '../args'
import { canCompleteShell, shellCompletion } from '../util'
import { Builtin } from './builtin'

function makeExport <T, TConst extends new (...args: any[]) => T> (ArgClass: TConst): (...args: ConstructorParameters<TConst>) => T {
  return (...args: any[]) => new ArgClass(...args)
}

class Help extends Builtin {
  constructor () {
    super('help')

    this.onArgument('help')
    this.onCommand('help')
  }

  async run (parser: Args<{}>): Promise<void> {
    console.log(parser.help())
  }
}

class Version extends Builtin {
  constructor () {
    super('version')

    this.onArgument('version')
  }

  async run (parser: Args<{}>): Promise<void> {
    console.log(`${parser.opts.programName} (${parser.opts.programVersion})`)
  }
}

class ShellCompletion extends Builtin {
  constructor () {
    super('shell-completion')

    this.onCommand('completion')
  }

  async run (parser: Args<{}>, __: Record<string, string[]>, positionals: string[]): Promise<void> {
    positionals = positionals.slice(1)
    const [shell] = positionals

    if (!positionals.length || !shell) {
      console.error('No shell provied to generate completions for')
      return
    }

    if (!canCompleteShell(shell)) {
      console.error(`No completions available for shell '${shell}'`)
      return
    }

    console.log(shellCompletion(shell, parser))
  }
}

export const help = makeExport<Help, typeof Help>(Help)
export const version = makeExport<Version, typeof Version>(Version)
export const completions = makeExport<ShellCompletion, typeof ShellCompletion>(ShellCompletion)
