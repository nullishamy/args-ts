import { Builtin, Command, Middleware, MinimalArgument } from './builder'
import { CoercionError, CommandError, ParseError, SchemaError } from './error'
import { generateHelp } from './util/help'
import { coerce, CoercedMultiValue, CoercedSingleValue } from './internal/parse/coerce'
import { tokenise } from './internal/parse/lexer'
import { ParsedArguments, parse } from './internal/parse/parser'
import { InternalCommand, InternalArgument, CoercedValue, InternalPositionalArgument, InternalFlagArgument } from './internal/parse/types'
import { Err, Ok, Result } from './internal/result'
import { ParserOpts, StoredParserOpts, defaultParserOpts } from './opts'
import { PrefixTree } from './internal/prefix-tree'

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
  // We store both a tree and a list so that we can iterate all values efficiently
  public arguments: PrefixTree<InternalArgument> = new PrefixTree()
  public argumentsList: InternalArgument[] = []

  public commands: PrefixTree<InternalCommand> = new PrefixTree()
  public commandsList: InternalCommand[] = []

  public builtins: Builtin[] = []
  public middlewares: Middleware[] = []
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

  public builtin (builtin: Builtin): Args<TArgTypes> {
    this.builtins.push(builtin)
    return this
  }

  public middleware (middleware: Middleware): Args<TArgTypes> {
    this.middlewares.push(middleware)
    return this
  }

  public command<TName extends string, TCommand extends Command> (
    [name, ...aliases]: [`${TName}`, ...string[]],
    command: TCommand,
    inherit = false
  ): Args<TArgTypes> {
    if (this.commands.has(name)) {
      throw new CommandError(`command '${name}' already declared`)
    }

    const existingBuiltin = this.builtins.find(b => b.commandTriggers.includes(name))
    if (existingBuiltin) {
      throw new CommandError(`command '${name}' conflicts with builtin '${existingBuiltin.id}' (${existingBuiltin.constructor.name})`)
    }

    let parser = new Args<unknown>({
      ...this.opts,
      ...command.opts.parserOpts
    })

    if (inherit) {
      parser.arguments = this.arguments
    }

    parser = command.args(parser)

    this.commands.insert(name, {
      inner: command,
      name,
      aliases,
      parser,
      isBase: true
    })

    this.commandsList.push({
      inner: command,
      name,
      aliases,
      parser,
      isBase: true
    })

    for (const alias of aliases) {
      if (this.commands.has(alias)) {
        throw new CommandError(`command alias '${alias}' already declared`)
      }
      const existingBuiltin = this.builtins.find(b => b.commandTriggers.includes(alias))
      if (existingBuiltin) {
        throw new CommandError(`command alias '${alias}' conflicts with builtin '${existingBuiltin.id}' (${existingBuiltin.constructor.name})`)
      }

      this.commands.insert(alias, {
        inner: command,
        name,
        aliases,
        parser,
        isBase: false
      })

      this.commandsList.push({
        inner: command,
        name,
        aliases,
        parser,
        isBase: false
      })
    }

    return this
  }

  public positional<TArg extends CoercedValue, TKey extends string> (
    key: `<${TKey}>`,
    declaration: MinimalArgument<TArg>
  ): Args<TArgTypes & {
      [key in TKey]: TArg
    }> {
    if (!key.startsWith('<') || !key.endsWith('>')) {
      throw new SchemaError(`keys must start with < and end with >, got ${key}`)
    }

    const slicedKey = key.slice(1, key.length - 1)

    const index = this.positionalIndex++
    this.arguments.insert(slicedKey, {
      type: 'positional',
      inner: declaration,
      key: slicedKey,
      index
    })

    this.argumentsList.push({
      type: 'positional',
      inner: declaration,
      key: slicedKey,
      index
    })

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

    if (this.arguments.has(longFlag.substring(2))) {
      throw new SchemaError(`duplicate long flag '${longFlag}'`)
    }

    if (!flagValidationRegex.test(longFlag)) {
      throw new SchemaError(`long flags must match '--abcdef...' got '${longFlag}'`)
    }

    this.arguments.insert(longFlag.substring(2), {
      type: 'flag',
      isLongFlag: true,
      inner: declaration,
      longFlag: longFlag.substring(2),
      shortFlag: shortFlag?.substring(1)
    })

    this.argumentsList.push({
      type: 'flag',
      isLongFlag: true,
      inner: declaration,
      longFlag: longFlag.substring(2),
      shortFlag: shortFlag?.substring(1)
    })

    if (shortFlag) {
      if (!shortFlag.startsWith('-')) {
        throw new SchemaError(`short flags must start with '-', got '${shortFlag}'`)
      }

      if (this.arguments.has(shortFlag.substring(1))) {
        throw new SchemaError(`duplicate short flag '${shortFlag}'`)
      }

      if (!flagValidationRegex.test(shortFlag)) {
        throw new SchemaError(`short flags must match '-abcdef...' got '${shortFlag}'`)
      }

      this.arguments.insert(shortFlag.substring(1), {
        type: 'flag',
        inner: declaration,
        isLongFlag: false,
        longFlag: longFlag.substring(2),
        shortFlag: shortFlag.substring(1)
      })

      this.argumentsList.push({
        type: 'flag',
        inner: declaration,
        isLongFlag: false,
        longFlag: longFlag.substring(2),
        shortFlag: shortFlag.substring(1)
      })
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

  private intoRaw (args: ParsedArguments): [Record<string, string[]>, string[]] {
    const { flags, positionals } = args
    const outFlags: Record<string, string[]> = {}
    const outPositionals: string[] = []

    for (const [key, flag] of flags.entries()) {
      outFlags[key] = flag.flatMap(f => {
        if (f.type === 'long') {
          return f.values
        } else if (f.type === 'short-group') {
          return []
        } else {
          return f.values
        }
      })
    }

    for (const positional of positionals.values()) {
      outPositionals.push(...positional.values)
    }

    return [outFlags, outPositionals]
  }

  public validate (): Result<this, SchemaError> {
    const positionals: InternalPositionalArgument[] = []
    const flags: InternalFlagArgument[] = []

    for (const value of this.argumentsList) {
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

  public async parseToResult (argString: string | string[], executeCommands = false): Promise<Result<ParseSuccess<TArgTypes>, ParseError | CoercionError[] | CommandError>> {
    this.opts.logger.debug(`Beginning parse of input '${argString}'`)

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
    if (command.type === 'default' && !this.commands.empty() && this.opts.mustProvideCommand) {
      return Err(new CommandError('no command provided but one was expected'))
    }

    if (command.type === 'user') {
      const commandParser = command.internal.parser
      coercionResult = await coerce(
        parseResult.val,
        commandParser.opts,
        commandParser.arguments,
        commandParser.argumentsList,
        [...commandParser.opts.defaultMiddlewares, ...commandParser.middlewares],
        commandParser.builtins
      )
    } else {
      coercionResult = await coerce(
        parseResult.val,
        this.opts,
        this.arguments,
        this.argumentsList,
        [...this.opts.defaultMiddlewares, ...this.middlewares],
        this.builtins
      )
    }

    if (!coercionResult.ok) {
      return coercionResult
    }

    const coercion = coercionResult.val

    // No command was found, just return the args
    if (coercion.command.type === 'default') {
      return Ok({
        mode: 'args',
        args: this.intoObject(coercion.args)
      })
    }

    // Builtin found, execute it and run, regardless of caller preference
    // builtins will always override the 'default' behaviour, so need to run
    if (coercion.command.type === 'builtin') {
      let executionResult

      try {
        await coercion.command.command.run(this, ...this.intoRaw(parseResult.val), coercion.command.trigger)
      } catch (err) {
        executionResult = err
      }

      return Ok({
        mode: 'command-exec',
        executionResult
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

  public async parse (argString: string | string[], executeCommands = false): Promise<ParseSuccess<TArgTypes>> {
    const result = await this.parseToResult(argString, executeCommands)

    if (!result.ok) {
      console.log(this.help())
      const prettyProblems = [result.err].flat().map(e => {
        return e.format()
      })
      console.log(`\nProblems:\n${prettyProblems.join('\n')}`)
      process.exit(1)
    }

    return result.val
  }

  public reset (): void {
    this.arguments = new PrefixTree()
    this.commands = new PrefixTree()
    this.middlewares = []
  }
}
