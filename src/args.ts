import { Command, Resolver, MinimalArgument, Builtin } from './builder'
import { CoercionError, CommandError, ParseError, SchemaError } from './error'
import { generateHelp } from './util/help'
import { coerce, CoercedMultiValue, CoercedSingleValue } from './internal/parse/coerce'
import { tokenise } from './internal/parse/lexer'
import { ParsedArguments, parse } from './internal/parse/parser'
import { InternalCommand, InternalArgument, CoercedValue, InternalPositionalArgument, InternalFlagArgument } from './internal/parse/types'
import { Err, Ok, Result } from './internal/result'
import { ParserOpts, StoredParserOpts, defaultParserOpts } from './opts'
import { PrefixTree } from './internal/prefix-tree'
import { getAliasDenotion, internaliseFlagString } from './internal/util'

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
  rest?: string
}

/**
 * The root class for the library. Generally, it represents a configured parser which can then be used to parse arbitrary input strings.
 *
 * It will hold all the state needed to parse inputs. This state is modified through the various helper methods defined on this class.
 */
export class Args<TArgTypes extends DefaultArgTypes = DefaultArgTypes> {
  // We store both a tree and a list so that we can iterate all values efficiently
  public arguments: PrefixTree<InternalArgument> = new PrefixTree()
  public argumentsList: InternalArgument[] = []

  public commands: PrefixTree<InternalCommand> = new PrefixTree()
  public commandsList: InternalCommand[] = []

  public resolvers: Resolver[] = []
  public builtins: Builtin[] = []
  public footerLines: string[] = []
  public headerLines: string[] = []

  public readonly opts: StoredParserOpts

  private positionalIndex = 0

  /**
   * Constructs a new parser with empty state, ready for configuration.
   * @param opts - The parser options to use
   */
  constructor (opts: ParserOpts) {
    this.opts = {
      ...defaultParserOpts,
      ...opts
    }
  }

  /**
   * Adds a {@link Resolver} to the configuration. This has no checks for duplicate resolvers.
   * @param resolver - The resolver to add
   * @returns this
   */
  public resolver (resolver: Resolver): Args<TArgTypes> {
    this.resolvers.push(resolver)
    return this
  }

  /**
   * Adds a {@link Builtin} to the configuration.
   * @param builtin - The builtin to add
   * @returns this
   */
  public builtin (builtin: Builtin): Args<TArgTypes> {
    this.builtins.push(builtin)
    return this
  }

  /**
   * Adds a {@link Command} to the configuration. This will enable commands / subcommands (declared on the Command itself)
   * to be recognised by the parser.
   *
   * If a command is not recognised by the parser, it will refer to the {@link ParserOpts.unrecognisedCommand} option to determine what to do.
   *
   * This will throw if the command or any of its aliases are already registered, or if it conflicts with the command triggers of a registered builtin.
   * @param param0 - The name and aliases to register
   * @param command - The command to register with
   * @param inherit - Whether to inherit arguments from this configuration into the parser
   * @returns this
   */
  public command<TName extends string, TCommand extends Command> (
    [name, ...aliases]: [`${TName}`, ...string[]],
    command: TCommand,
    inherit = false
  ): Args<TArgTypes> {
    if (this.commands.has(name)) {
      throw new CommandError(`command '${name}' already declared`)
    }

    const existingBuiltin = this.builtins.find(b => b.commandTriggers.includes(name) || aliases.some(a => b.commandTriggers.includes(a)))
    if (existingBuiltin) {
      throw new CommandError(`command '${name}' conflicts with builtin '${existingBuiltin.id}' (${existingBuiltin.constructor.name})`)
    }

    let parser = new Args<{}>({
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

  /**
   * Add a positional {@link Argument} to the configuration. Conflict behaviour with commands is described in {@link command}
   * If a positional exists with the provided key, this will throw.
   * @param key - The key to use for the positional, maps to the output object.
   * @param arg - The argument to register
   * @returns this
   */
  public positional<TArg extends CoercedValue, TKey extends string> (
    key: `<${TKey}>`,
    arg: MinimalArgument<TArg>
  ): Args<TArgTypes & {
      [key in TKey]: TArg
    }> {
    if (!key.startsWith('<') || !key.endsWith('>')) {
      throw new SchemaError(`keys must start with < and end with >, got ${key}`)
    }

    const slicedKey = key.slice(1, key.length - 1)
    if (this.arguments.has(slicedKey)) {
      throw new SchemaError(`duplicate positional key '${slicedKey}'`)
    }

    const index = this.positionalIndex++
    this.arguments.insert(slicedKey, {
      type: 'positional',
      inner: arg,
      key: slicedKey,
      index
    })

    this.argumentsList.push({
      type: 'positional',
      inner: arg,
      key: slicedKey,
      index
    })

    // @ts-expect-error same inference problem as arg()
    return this
  }

  /**
   * Add a flag argument to the configuration. The first long flag is used as the key in the output object
   * so must be given. Any aliases after that are just used as alternatives, and will not appear in the output object
   *
   * If the key or any aliases exist in the config, this will throw.
   * @param param0 - The key and aliases to register
   * @param arg - The argument to register
   * @returns this
   */
  public arg<TArg extends CoercedValue, TLong extends string> (
    [_longFlag, ..._aliases]: [`--${TLong}`, ...Array<`-${string}` | `--${string}`>],
    arg: MinimalArgument<TArg>
  ): Args<TArgTypes & {
      // Add the key to our object of known args
      [key in TLong]: TArg
    }> {
    const [,longFlag] = internaliseFlagString(_longFlag)
    const aliases = _aliases.map(a => {
      const [type, value] = internaliseFlagString(a)
      return {
        type,
        value
      }
    })

    if (this.arguments.has(longFlag)) {
      throw new SchemaError(`duplicate long flag '${_longFlag}'`)
    }

    for (const alias of aliases) {
      if (this.arguments.has(alias.value)) {
        throw new SchemaError(`duplicate alias '${getAliasDenotion(alias)}'`)
      }

      this.arguments.insert(alias.value, {
        type: 'flag',
        isLongFlag: true,
        inner: arg,
        longFlag,
        aliases
      })
    }

    this.arguments.insert(longFlag, {
      type: 'flag',
      isLongFlag: true,
      inner: arg,
      longFlag,
      aliases
    })

    this.argumentsList.push({
      type: 'flag',
      isLongFlag: true,
      inner: arg,
      longFlag,
      aliases
    })

    // @ts-expect-error can't infer this because of weird subtyping, not a priority
    return this
  }

  /**
   * @internal
   */
  private intoObject (coerced: Map<InternalArgument, CoercedMultiValue | CoercedSingleValue>, rest: string | undefined): TArgTypes {
    const out = Object.fromEntries([...coerced.entries()].map(([key, value]) => {
      if (key.type === 'flag') {
        return [key.longFlag, value.coerced]
      } else {
        return [key.key, value.coerced]
      }
    })) as TArgTypes
    if (rest) {
      out.rest = rest
    }

    return out
  }

  /**
   * @internal
   */
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

  /**
   * Validate that the schema is okay to use. This detects problems which cannot be detected
   * at a type level. This may be expensive to call, so should not be used in production.
   *
   * It is advised to run this in tests, and when your schema changes.
   * If there *are* problems, and this is not called & handled, the behaviour of the parser is undefined.
   * @returns `SchemaError` if there is a problem, `this` otherwise
   */
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

  /**
   * Generate the help string for this configuration. This is an alias for {@link generateHelp}, passing in `this`.
   * @returns The generated help string
   */
  public help (): string {
    return generateHelp(this)
  }

  /**
   * Appends or overwrites the footer lines, which are shown at the bottom of the help string.
   * @param line - The footer line to show
   * @param append - Whether to append, or overwrite
   * @returns this
   */
  public footer (line: string, append = true): Args<TArgTypes> {
    if (append) {
      this.footerLines.push(line)
    } else {
      this.footerLines = [line]
    }

    return this
  }

  /**
   * Appends or overwrites the header lines, which are shown at the top of the help string.
   * @param line - The header line to show
   * @param append - Whether to append, or overwrite
   * @returns this
   */
  public header (line: string, append = true): Args<TArgTypes> {
    if (append) {
      this.headerLines.push(line)
    } else {
      this.headerLines = [line]
    }

    return this
  }

  /**
   * Attempt to parse the provided arguments, returning the result of the operation.
   * This is an alternative to {@link parse}, allowing the caller to control what happens in the event of parse failure.
   * @param argString - The arguments to parse
   * @param executeCommands - Whether to execute discovered commands, or return them
   * @returns The result of the parse
   */
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
        [...commandParser.opts.resolvers, ...commandParser.resolvers],
        commandParser.builtins
      )
    } else {
      coercionResult = await coerce(
        parseResult.val,
        this.opts,
        this.arguments,
        this.argumentsList,
        [...this.opts.resolvers, ...this.resolvers],
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
        args: this.intoObject(coercion.args, coercion.rest?.value)
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
        await coercion.command.internal.inner.run(this.intoObject(coercion.args, coercion.rest?.value))
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
      parsedArgs: this.intoObject(coercion.args, coercion.rest?.value),
      command: coercion.command.internal.inner
    })
  }

  /**
   * Parses the provided arguments, printing the problems and exiting if the parse fails.
   * Callers can use {@link parseToResult} if control of parse failure behaviour is required.
   * @param argString - The arguments to parse
   * @param executeCommands - Whether to execute discovered commands, or return them
   * @returns The result of the parse, never an error
   */
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
    this.resolvers = []
  }
}
