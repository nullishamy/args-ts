import { Argument, Command } from './builder'
import { ArgError, CommandError } from './error'
import { tokenise } from './internal/parse/lexer'
import { MultiParsedValue, parseAndCoerce, SingleParsedValue } from './internal/parse/parser'
import { InternalCommand, InternalArgument, CoercedValue } from './internal/parse/types'
import { Ok, Result } from './internal/result'
import { ParserOpts } from './opts'

// What happened when we parsed
interface FoundCommand {
  mode: 'command-exec'
  executionResult: unknown
}

interface ReturnedCommand<T> {
  mode: 'command'
  command: Command
  parsedArgs: T
}

interface ParsedArgs<T> {
  mode: 'args'
  args: T
}

type ParseSuccess<TArgTypes> = FoundCommand | ReturnedCommand<TArgTypes> | ParsedArgs<TArgTypes>

export class Args<TArgTypes = {
  [k: string]: CoercedValue
}> {
  public arguments: Record<string, InternalArgument> = {}
  public commands: Record<string, InternalCommand> = {}

  constructor (public readonly opts: ParserOpts) {}

  public command<TName extends string, TCommand extends Command> (
    [name, ...aliases]: [`${TName}`, ...string[]],
    command: TCommand
  ): Args<TArgTypes> {
    if (this.commands[name]) {
      throw new CommandError(`command ${name} already declared`)
    }

    let parser = new Args<unknown>({
      ...this.opts,
      ...command.opts.parserOpts
    })

    parser = command.args(parser)

    this.commands[name] = {
      inner: command,
      name,
      aliases,
      parser
    }

    for (const alias of aliases) {
      if (this.commands[alias]) {
        throw new CommandError(`command alias ${alias} already declared`)
      }

      this.commands[alias] = {
        inner: command,
        name,
        aliases,
        parser
      }
    }

    return this
  }

  public add<TArg extends CoercedValue = never, TLong extends string = never> (
    [longFlag, shortFlag]: [`--${TLong}`, `-${string}`?],
    declaration: Argument<TArg>
  ): Args<TArgTypes & {
      // Add the key to our object of known args
      [key in TLong]: TArg
    }> {
    if (!longFlag.startsWith('--')) {
      throw new ArgError(`long flags must start with '--', got '${longFlag}'`)
    }

    if (this.arguments[longFlag.substring(2)]) {
      throw new ArgError(`duplicate long flag '${longFlag}'`)
    }

    this.arguments[longFlag.substring(2)] = {
      inner: declaration,
      longFlag: longFlag.substring(2),
      shortFlag: shortFlag?.substring(1)
    }

    if (shortFlag) {
      if (!shortFlag.startsWith('-')) {
        throw new ArgError(`short flags must start with '-', got '${shortFlag}'`)
      }

      if (this.arguments[shortFlag.substring(1)]) {
        throw new ArgError(`duplicate short flag '${shortFlag}'`)
      }

      this.arguments[shortFlag.substring(1)] = {
        inner: declaration,
        longFlag: longFlag.substring(2),
        shortFlag: shortFlag.substring(1)
      }
    }

    // @ts-expect-error can't infer this because of weird subtyping, not a priority
    return this
  }

  private intoObject (coerced: Map<InternalArgument, MultiParsedValue | SingleParsedValue>): TArgTypes {
    return Object.fromEntries([...coerced.entries()].map(([key, value]) => [key.longFlag, value.coerced])) as TArgTypes
  }

  public async parse (argString: string, executeCommands = false): Promise<Result<ParseSuccess<TArgTypes>>> {
    const tokenResult = tokenise(argString)
    if (!tokenResult.ok) {
      return tokenResult
    }

    const tokens = tokenResult.val

    const commandResult = await parseAndCoerce(
      tokens,
      this.opts,
      this.commands,
      this.arguments
    )

    if (!commandResult.ok) {
      return commandResult
    }

    const commandObject = commandResult.val

    // No command was found, just return the args
    if (commandObject.isDefault) {
      return Ok({
        mode: 'args',
        args: this.intoObject(commandObject.arguments)
      })
    }

    // Caller wants us to execute, return the result of the execution
    if (executeCommands) {
      return Ok({
        mode: 'command-exec',
        executionResult: await commandObject.command.run(this.intoObject(commandObject.arguments))
      })
    }

    // Command was found, return it
    return Ok({
      mode: 'command',
      parsedArgs: this.intoObject(commandObject.arguments),
      command: commandObject.command
    })
  }

  public reset (): void {
    this.arguments = {}
  }
}
