import { Command, MinimalArgument } from './builder'
import { CoercionError, CommandError, ParseError, SchemaError } from './error'
import { generateHelp } from './util/help'
import { coerce, CoercedMultiValue, CoercedSingleValue } from './internal/parse/coerce'
import { tokenise } from './internal/parse/lexer'
import { parse } from './internal/parse/parser'
import { InternalCommand, InternalArgument, CoercedValue, InternalPositionalArgument, InternalFlagArgument } from './internal/parse/types'
import { Err, Ok, Result } from './internal/result'
import { ParserOpts, StoredParserOpts, defaultParserOpts } from './opts'

const flagValidationRegex = /-+(?:[a-z]+)/

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
export interface DefaultArgTypes {
  [k: string]: CoercedValue
}

export class Args<TArgTypes = DefaultArgTypes> {
  public arguments: Record<string, InternalArgument> = {}
  public commands: Record<string, InternalCommand> = {}
  public footerLines: string[] = []
  public headerLines: string[] = []

  public readonly opts: StoredParserOpts

  private positionalIndex = 0

  constructor (opts: ParserOpts) {
    this.opts = {
      ...defaultParserOpts,
      ...opts
    }
  }

  public command<TName extends string, TCommand extends Command> (
    [name, ...aliases]: [`${TName}`, ...string[]],
    command: TCommand,
    inherit = false
  ): Args<TArgTypes> {
    if (this.commands[name]) {
      throw new CommandError(`command ${name} already declared`)
    }

    let parser = new Args<unknown>({
      ...this.opts,
      ...command.opts.parserOpts
    })

    if (inherit) {
      parser.arguments = this.arguments
    }

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

  public positional<TArg extends CoercedValue, TKey extends string> (
    key: `<${TKey}>`,
    declaration: MinimalArgument<TArg>
  ): Args<TArgTypes & {
      [key in TKey]: TArg
    }> {
    if (!key.startsWith('<') && !key.endsWith('>')) {
      throw new SchemaError(`keys must start with < and end with >, got ${key}`)
    }

    const slicedKey = key.slice(1, key.length - 1)

    this.arguments[slicedKey] = {
      type: 'positional',
      inner: declaration,
      key: slicedKey,
      index: this.positionalIndex++
    }

    // @ts-expect-error same inference problem as arg()
    return this
  }

  public arg<TArg extends CoercedValue, TLong extends string> (
    [longFlag, shortFlag]: [`--${TLong}`, `-${string}`?],
    declaration: MinimalArgument<TArg>
  ): Args<TArgTypes & {
      // Add the key to our object of known args
      [key in TLong]: TArg
    }> {
    if (!longFlag.startsWith('--')) {
      throw new SchemaError(`long flags must start with '--', got '${longFlag}'`)
    }

    if (this.arguments[longFlag.substring(2)]) {
      throw new SchemaError(`duplicate long flag '${longFlag}'`)
    }

    if (!flagValidationRegex.test(longFlag)) {
      throw new SchemaError(`long flags must match '--abcdef...' got '${longFlag}'`)
    }

    this.arguments[longFlag.substring(2)] = {
      type: 'flag',
      isPrimary: true,
      inner: declaration,
      longFlag: longFlag.substring(2),
      shortFlag: shortFlag?.substring(1)
    }

    if (shortFlag) {
      if (!shortFlag.startsWith('-')) {
        throw new SchemaError(`short flags must start with '-', got '${shortFlag}'`)
      }

      if (this.arguments[shortFlag.substring(1)]) {
        throw new SchemaError(`duplicate short flag '${shortFlag}'`)
      }

      if (!flagValidationRegex.test(shortFlag)) {
        throw new SchemaError(`short flags must match '-abcdef...' got '${shortFlag}'`)
      }

      this.arguments[shortFlag.substring(1)] = {
        type: 'flag',
        inner: declaration,
        isPrimary: false,
        longFlag: longFlag.substring(2),
        shortFlag: shortFlag.substring(1)
      }
    }

    // @ts-expect-error can't infer this because of weird subtyping, not a priority
    return this
  }

  private intoObject (coerced: Map<InternalArgument, CoercedMultiValue | CoercedSingleValue>): TArgTypes {
    return Object.fromEntries([...coerced.entries()].map(([key, value]) => {
      if (key.type === 'flag') {
        return [key.longFlag, value.coerced]
      } else {
        return [key.key, value.coerced]
      }
    })) as TArgTypes
  }

  public validate (): Result<this, SchemaError> {
    const positionals: InternalPositionalArgument[] = []
    const flags: InternalFlagArgument[] = []

    for (const value of Object.values(this.arguments)) {
      if (value.type === 'flag') {
        flags.push(value)
      } else {
        positionals.push(value)
      }
    }

    if (positionals.filter(p => p.inner._meta.isMultiType).length > 1) {
      return Err(new SchemaError('multiple multi-type positionals found'))
    }
    return Ok(this)
  }

  public help (): string {
    return generateHelp(this)
  }

  public footer (line: string, append = true): Args<TArgTypes> {
    if (append) {
      this.footerLines.push(line)
    } else {
      this.footerLines = [line]
    }

    return this
  }

  public header (line: string, append = true): Args<TArgTypes> {
    if (append) {
      this.headerLines.push(line)
    } else {
      this.headerLines = [line]
    }

    return this
  }

  public async parse (argString: string | string[], executeCommands = false): Promise<Result<ParseSuccess<TArgTypes>, ParseError | CoercionError[] | Error>> {
    const tokenResult = tokenise(Array.isArray(argString) ? argString.join(' ') : argString)

    if (!tokenResult.ok) {
      return tokenResult
    }

    const tokens = tokenResult.val

    const parseResult = parse(tokens, this.commands, this.opts)
    if (!parseResult.ok) {
      return parseResult
    }

    const { command } = parseResult.val

    // If we located a command, tell coerce to use its parser instead of our own
    let coercionResult
    if (!command.isDefault) {
      const commandParser = command.internal.parser
      coercionResult = await coerce(parseResult.val, commandParser.opts, commandParser.arguments)
    } else {
      coercionResult = await coerce(parseResult.val, this.opts, this.arguments)
    }

    if (!coercionResult.ok) {
      return coercionResult
    }

    const coercion = coercionResult.val

    // No command was found, just return the args
    if (coercion.command.isDefault) {
      return Ok({
        mode: 'args',
        args: this.intoObject(coercion.args)
      })
    }

    // Caller wants us to execute, return the result of the execution
    if (executeCommands) {
      let executionResult

      try {
        await coercion.command.internal.inner.run(this.intoObject(coercion.args))
      } catch (err) {
        executionResult = err
      }

      return Ok({
        mode: 'command-exec',
        executionResult
      })
    }

    // Command was found, return it
    return Ok({
      mode: 'command',
      parsedArgs: this.intoObject(coercion.args),
      command: coercion.command.internal.inner
    })
  }

  public reset (): void {
    this.arguments = {}
    this.commands = {}
  }
}
