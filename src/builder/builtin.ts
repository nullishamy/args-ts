import { Args } from '../args'

/**
 * Represents a builtin command (such as help, version information) within a parser configuration.
 *
 * These are contained separately from {@link Command}s because they may be triggered by flags, and will always require
 * special casing when being executed.
 *
 * A builtin match will always override user commands, and will halt argument coercion.
 */
export abstract class Builtin {
  public commandTriggers: string[] = []
  public argumentTriggers: string[] = []

  public constructor (public readonly id: string) {}

  /**
   * Adds a command to the known command triggers for this builtin
   * @param command - The command to trigger this builtin on
   * @returns this
   */
  public onCommand (command: string): Builtin {
    this.commandTriggers.push(command)
    return this
  }

  /**
   * Adds a flag to the known argument triggers for this builtin
   * @param command - The flag to trigger this builtin on
   * @returns this
   */
  public onArgument (argument: string): Builtin {
    this.argumentTriggers.push(argument)
    return this
  }

  /**
   * Clear all known triggers from this builtin
   * @returns this
   */
  public clearTriggers (): Builtin {
    this.commandTriggers = []
    this.argumentTriggers = []
    return this
  }

  /**
   * Execute a builtin.
   * @param parser - The current parser
   * @param flags - The raw flag arguments
   * @param positionals - The raw positional arguments
   * @param trigger - The flag / command that triggered this builtin
   */
  abstract run (parser: Args<{}>, flags: Record<string, string[]>, positionals: string[], trigger: string): Promise<void>

  /**
   * Generate the help string for this builtin. Describes the triggers which this builtin runs on.
   * @returns The generated help string
   */
  public helpInfo (): string {
    const commands = this.commandTriggers.map(cmd => `${cmd} <...args>`).join(', ')
    const args = this.argumentTriggers.map(arg => `--${arg}`).join(', ')

    if (commands && args) {
      return `${commands} | ${args}`
    }

    if (commands) {
      return commands
    }

    if (args) {
      return args
    }

    return `${this.constructor.name} | no triggers`
  }
}
