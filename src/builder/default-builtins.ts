import { Args } from '../args'
import { canCompleteShell, shellCompletion } from '../util'
import { Builtin } from './builtin'

export class Help extends Builtin {
  constructor () {
    super('help')

    this.onArgument('help')
    this.onCommand('help')
  }

  async run (parser: Args<unknown>): Promise<void> {
    console.log(parser.help())
  }
}

export class Version extends Builtin {
  constructor () {
    super('version')

    this.onArgument('version')
  }

  async run (parser: Args<unknown>): Promise<void> {
    console.log(`${parser.opts.programName} (${parser.opts.programVersion})`)
  }
}

export class ShellCompletion extends Builtin {
  constructor () {
    super('shell-completion')

    this.onCommand('completion')
  }

  async run (parser: Args<unknown>, __: Record<string, string[]>, positionals: string[]): Promise<void> {
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
