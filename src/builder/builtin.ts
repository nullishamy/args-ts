import { Args } from '../args'

export abstract class Builtin {
  public commandTriggers: string[] = []
  public argumentTriggers: string[] = []

  public constructor (public readonly id: string) {}

  public onCommand (command: string): Builtin {
    this.commandTriggers.push(command)
    return this
  }

  public onArgument (argument: string): Builtin {
    this.argumentTriggers.push(argument)
    return this
  }

  public clearTriggers (): Builtin {
    this.commandTriggers = []
    this.argumentTriggers = []
    return this
  }

  abstract run (parser: Args<{}>, flags: Record<string, string[]>, positionals: string[], trigger: string): Promise<void>

  helpInfo (): string {
    return `${this.commandTriggers.map(cmd => `${cmd} <...args>`).join(', ')} | ${this.argumentTriggers.map(arg => `--${arg}`).join(', ')}`
  }
}

export type BuiltinType = 'help' | 'completion' | 'version' | 'fallback'
