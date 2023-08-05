import { Args, DefaultArgTypes } from '../args'
import { CommandError } from '../error'
import { InternalCommand } from '../internal/parse/types'
import { ExtractArgType } from '../internal/types'
import { CommandOpts } from '../opts'
/**
 * Base class for all commands, including subcommands. Any user implemented command must extend from this class.
 */
export abstract class Command {
  constructor (
    public readonly opts: CommandOpts
  ) { }

  public _subcommands: Record<string, InternalCommand> = {}

  // Must use any for it to accept the subtyping this function actually performs
  // Black magic happens later on to extract the real subtype out of this `any`
  abstract args: <T> (parser: Args<T>) => Args<any>
  abstract run: (args: ExtractArgType<ReturnType<this['args']>>) => Promise<unknown>

  /**
   * Creates a runner function for use with {@link Command#run}. This exists to provide type inference to the callback, which is not available without a function call.
   * @param runFn - the run function
   * @returns - the run implementation
   */
  runner (runFn: (args: (ExtractArgType<ReturnType<this['args']>> & DefaultArgTypes)) => Promise<unknown>): (args: ExtractArgType<ReturnType<this['args']>>) => Promise<unknown> {
    return async (args) => await runFn(args)
  }

  /**
   * Register a subcommand with this command. This will setup the parser and load the defition into the base parser.
   * @param param0 - the name and (optional) aliases of the subcommand
   * @param subcommand - the subcommand definition
   * @returns this
   */
  subcommand ([name, ...aliases]: [string, ...string[]], subcommand: Command): this {
    if (this._subcommands[name]) {
      throw new CommandError(`subcommand ${name} already registered`)
    }

    let parser = new Args<unknown>({
      ...this.opts,
      ...subcommand.opts.parserOpts
    })

    parser = subcommand.args(parser)

    this._subcommands[name] = {
      inner: subcommand,
      name,
      aliases,
      parser
    }

    for (const alias of aliases) {
      if (this._subcommands[alias]) {
        throw new CommandError(`subcommand alias ${name}/${name} already registered`)
      }

      this._subcommands[alias] = {
        inner: subcommand,
        name,
        aliases,
        parser
      }
    }

    return this
  }
}
