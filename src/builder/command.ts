import { Args, ExtractArgType, ParserOpts } from '../args'

export interface CommandOpts {
  description: string
  parserOpts?: Partial<ParserOpts>
}

export abstract class Command {
  constructor (
    public readonly opts: CommandOpts
  ) { }

  abstract args: <T> (parser: Args<T>) => Args<unknown>
  abstract run: (args: ExtractArgType<ReturnType<this['args']>>) => Promise<unknown>
  runner (runFn: (args: (ExtractArgType<ReturnType<this['args']>>)) => Promise<unknown>): (args: ExtractArgType<ReturnType<this['args']>>) => Promise<unknown> {
    return async (args) => await runFn(args)
  }
}
