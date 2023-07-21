import { Argument, Command } from './builder'
import { ParseError } from './error'
import { tokenise, parseArgumentTokens, coerceParsedValues, WrappedDeclaration, WrappedCommand, RuntimeValue } from './parser'
export interface ParserOpts {
  programName: string
  programDescription: string
  unknownArgBehaviour: 'skip' | 'throw'
  excessArgBehaviour: 'drop' | 'throw'
}

// What happened when we parsed
interface FoundCommand {
  mode: 'command-exec'
  executionResult: unknown
}

interface ReturnedCommand {
  mode: 'command'
  command: undefined // TODO: Don't know what we want to return here
}

interface ParsedArgs<T> {
  mode: 'args'
  args: T
}

export type ExtractArgType<ArgObject, Default = never> = ArgObject extends Args<infer TArgs> ? TArgs : Default
export class Args<TArgTypes = {
  [k: string]: boolean | string | number | object | undefined
}, TCommands = {}> {
  private declarations: Record<string, WrappedDeclaration> = {}
  private commands: Record<string, WrappedCommand> = {}

  constructor (private readonly opts: ParserOpts) {}

  public command<
    TName extends string,
    TCommand extends Command,
  >(
    [name, ...aliases]: [`${TName}`, ...string[]],
    command: TCommand
  ): Args<TArgTypes, TCommands & {
      commands: {
        [key in TName]: ExtractArgType<ReturnType<TCommand['args']>>
      }
    }> {
    if (this.commands[name]) {
      throw new ParseError(`command ${name} already declared`)
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
        throw new ParseError(`command alias ${alias} already declared`)
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

  public add<
    // The declared argument type
    TArg = never,
    // The long declaration of the argument, used to setup the keys in the parsed object
    TLong extends string = never,
  >(
    // We don't need to care about the actual value of the short flag, we are only
    // going to provide the keys for the long variant. This is mostly because handling both keys,
    // particularly in the type system, is very annoying and overall very un-needed.
    [longFlag, shortFlag]: [`--${TLong}`, `-${string}`?],
    declaration: Argument<TArg>
  ): Args<TArgTypes & {
      // Add the key to our object of known args
      [key in TLong]: TArg
    }> {
    if (!longFlag.startsWith('--')) {
      throw new ParseError(`long flags must start with '--', got '${longFlag}'`)
    }

    if (this.declarations[longFlag.substring(2)]) {
      throw new ParseError(`duplicate long flag '${longFlag}'`)
    }

    this.declarations[longFlag.substring(2)] = {
      inner: declaration,
      longFlag: longFlag.substring(2),
      shortFlag: shortFlag?.substring(1)
    }

    if (shortFlag) {
      if (!shortFlag.startsWith('-')) {
        throw new ParseError(`short flags must start with '-', got '${shortFlag}'`)
      }

      if (this.declarations[shortFlag.substring(1)]) {
        throw new ParseError(`duplicate short flag '${shortFlag}'`)
      }

      this.declarations[shortFlag.substring(1)] = {
        inner: declaration,
        longFlag: longFlag.substring(2),
        shortFlag: shortFlag.substring(1)
      }
    }

    // @ts-expect-error inferrence is broken
    return this
  }

  private intoObject (coerced: Map<WrappedDeclaration, RuntimeValue>, opts: ParserOpts): TArgTypes {
    return Object.fromEntries([...coerced.entries()].map(([key, value]) => {
      if (key.inner._isMultiType) {
        return [key.longFlag, value.parsed]
      } else {
        if (value.parsed.length > 1) {
          // Excessive arguments to single argument, follow configured behaviour
          if (opts.excessArgBehaviour === 'throw') {
            throw new ParseError(`excessive argument(s) '${value.parsed.slice(1).join(', ')}' for argument '--${value.declaration.longFlag}'`)
          }
        }
        const singleValue = value.parsed[0]
        // Only throw if undefined is unexpected (not optional)
        if (singleValue === undefined && !key.inner._optional) {
          throw new ParseError(`impossible; no single value set for ${value.declaration.longFlag} / ${value.declaration.shortFlag}`)
        }
        return [key.longFlag, singleValue]
      }
    })) as TArgTypes
  }

  public async parse (argString: string): Promise<FoundCommand | ReturnedCommand | ParsedArgs<TArgTypes>> {
    const tokens = tokenise(argString)
    let command: WrappedCommand | undefined
    // First token is a value, try and use it as a command
    if (tokens[0]?.type === 'value') {
      const declaredCommandName = tokens[0]?.userValue
      command = this.commands[declaredCommandName]

      if (!command) {
        // TODO: Should this be configurable?
        throw new ParseError(`unknown command '${declaredCommandName}', if you meant to pass an argument, try prefixing with '-' or '--'`)
      }

      // Slice off our command token, then parse out the rest of the arguments
      const commandArgs = parseArgumentTokens(tokens.slice(1))
      const coercedCommandArgs = await coerceParsedValues(commandArgs, command.parser.declarations, command.parser.opts)
      const objectArgs = this.intoObject(coercedCommandArgs, command.parser.opts)

      let commandResult: unknown

      // Try to run the command, catch any errors
      try {
        commandResult = await command.inner.run(objectArgs)
      } catch (err) {
        throw new ParseError(`error whilst running command '${declaredCommandName}'`, {
          cause: err
        })
      }

      return {
        mode: 'command-exec',
        executionResult: commandResult
      }
    }

    const parsed = parseArgumentTokens(tokens)
    const matched = await coerceParsedValues(parsed, this.declarations, this.opts)

    return {
      mode: 'args',
      args: this.intoObject(matched, this.opts)
    }
  }

  public reset (): void {
    this.declarations = {}
  }
}
