import { Args } from '../args'
import { CommandError } from '../error'
import { InternalCommand } from '../internal/parse/types'
import { ExtractArgType } from '../internal/types'
import { CommandOpts } from '../opts'
export abstract class Command {
  constructor (
    public readonly opts: CommandOpts
  ) { }

  public _subcommands: Record<string, InternalCommand> = {}

  // Must use any for it to accept the subtyping this function actually performs
  // Black magic happens later on to extract the real subtype out of this `any`
  abstract args: <T> (parser: Args<T>) => Args<any>
  abstract run: (args: ExtractArgType<ReturnType<this['args']>>) => Promise<unknown>

  runner (runFn: (args: (ExtractArgType<ReturnType<this['args']>>)) => Promise<unknown>): (args: ExtractArgType<ReturnType<this['args']>>) => Promise<unknown> {
    return async (args) => await runFn(args)
  }

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
