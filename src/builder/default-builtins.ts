import { Args } from '../args'
import { Builtin } from './builtin'

export class Help extends Builtin {
  constructor () {
    super()

    this.onArgument('help')
    this.onCommand('help')
  }

  async run (parser: Args<unknown>): Promise<void> {
    console.log(parser.help())
  }
}

export class Version extends Builtin {
  constructor () {
    super()

    this.onArgument('version')
  }

  async run (parser: Args<unknown>): Promise<void> {
    console.log(`${parser.opts.programName} (${parser.opts.programVersion})`)
  }
}

export class ShellCompletion extends Builtin {
  constructor () {
    super()

    this.onCommand('completion')
  }

  async run (_: Args<unknown>, args: Record<string | number, string[]>): Promise<void> {
    const shells = Object.entries(args)
      .filter(([k]) => {
        const num = Number(k)
        return !isNaN(num) && num > 0
      })
      .flatMap(([,v]) => v)

    if (!shells) {
      console.error('No shells provied to generate completions for')
      return
    }

    for (const shell of shells) {
      console.log(`Generated completions for ${shell}`)
    }
  }
}
