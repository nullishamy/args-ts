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

interface ReturnedCommand<TArgs, TCommand> {
  mode: 'command'
  command: TCommand
  parsedArgs: TArgs
}

interface ParsedArgs<T> {
  mode: 'args'
  args: T
}

type ParseSuccess<TArgTypes, TCommand> = FoundCommand | ReturnedCommand<TArgTypes, TCommand> | ParsedArgs<TArgTypes>
export interface DefaultArgTypes {
  [k: string]: CoercedValue
  ['--']?: string
}

export interface ArgsState {

  arguments: PrefixTree<InternalArgument>
  argumentsList: InternalArgument[]

  commands: PrefixTree<InternalCommand>
  commandsList: InternalCommand[]

  resolvers: Resolver[]
  builtins: Builtin[]
  footerLines: string[]
  headerLines: string[]
}

/**
 * The root class for the library. Generally, it represents a configured parser which can then be used to parse arbitrary input strings.
 *
 * It will hold all the state needed to parse inputs. This state is modified through the various helper methods defined on this class.
 */
export class Args<TArgTypes extends DefaultArgTypes = DefaultArgTypes, TCommandType extends Command = Command> {
  public readonly opts: StoredParserOpts
  public readonly _state: ArgsState

  private positionalIndex = 0

  /**
   * Constructs a new parser with empty state, ready for configuration.
   * @param opts - The parser options to use
   * @param existingState - The previous state to uses
   */
  constructor (opts: ParserOpts, existingState?: ArgsState) {
    this.opts = {
      ...defaultParserOpts,
      ...opts
    }

    this._state = existingState ?? {
      // We store both a tree and a list so that we can iterate all values efficiently
      arguments: new PrefixTree(),
      argumentsList: [],

      commands: new PrefixTree(),
      commandsList: [],

      resolvers: [...this.opts.resolvers],
      builtins: [],
      footerLines: [],
      headerLines: []
    }
  }

  /**
   * Adds a {@link Resolver} to the configuration. This has no checks for duplicate resolvers.
   * @param resolver - The resolver to add
   * @returns this
   */
  public resolver (resolver: Resolver): Args<TArgTypes> {
    this._state.resolvers.push(resolver)
    return this
  }

  /**
   * Adds a {@link Builtin} to the configuration.
   * @param builtin - The builtin to add
   * @returns this
   */
  public builtin (builtin: Builtin): Args<TArgTypes> {
    this._state.builtins.push(builtin)
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
  public command <T extends Command> (
    [name, ...aliases]: [string, ...string[]],
    command: T,
    inherit = false
  ): Args<TArgTypes, T> {
    if (this._state.commands.has(name)) {
      throw new CommandError(`command '${name}' already declared`)
    }

    const existingBuiltin = this._state.builtins.find(b => b.commandTriggers.includes(name) || aliases.some(a => b.commandTriggers.includes(a)))
    if (existingBuiltin) {
      throw new CommandError(`command '${name}' conflicts with builtin '${existingBuiltin.id}' (${existingBuiltin.constructor.name})`)
    }

    let parser = new Args<{}>({
      ...this.opts,
      ...command.opts.parserOpts
    })

    if (inherit) {
      parser._state.arguments = this._state.arguments
    }

    parser = command.args(parser)

    this._state.commands.insert(name, {
      inner: command,
      name,
      aliases,
      parser,
      isBase: true
    })

    this._state.commandsList.push({
      inner: command,
      name,
      aliases,
      parser,
      isBase: true
    })

    for (const alias of aliases) {
      if (this._state.commands.has(alias)) {
        throw new CommandError(`command alias '${alias}' already declared`)
      }
      const existingBuiltin = this._state.builtins.find(b => b.commandTriggers.includes(alias))
      if (existingBuiltin) {
        throw new CommandError(`command alias '${alias}' conflicts with builtin '${existingBuiltin.id}' (${existingBuiltin.constructor.name})`)
      }

      this._state.commands.insert(alias, {
        inner: command,
        name,
        aliases,
        parser,
        isBase: false
      })

      this._state.commandsList.push({
        inner: command,
        name,
        aliases,
        parser,
        isBase: false
      })
    }

    // @ts-expect-error erased commands can't resolve into concrete type
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
    if (this._state.arguments.has(slicedKey)) {
      throw new SchemaError(`duplicate positional key '${slicedKey}'`)
    }

    const index = this.positionalIndex++
    this._state.arguments.insert(slicedKey, {
      type: 'positional',
      inner: arg,
      key: slicedKey,
      index
    })

    this._state.argumentsList.push({
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

    if (this._state.arguments.has(longFlag)) {
      throw new SchemaError(`duplicate long flag '${_longFlag}'`)
    }

    for (const alias of aliases) {
      if (this._state.arguments.has(alias.value)) {
        throw new SchemaError(`duplicate alias '${getAliasDenotion(alias)}'`)
      }

      this._state.arguments.insert(alias.value, {
        type: 'flag',
        isLongFlag: true,
        inner: arg,
        longFlag,
        aliases
      })
    }

    this._state.arguments.insert(longFlag, {
      type: 'flag',
      isLongFlag: true,
      inner: arg,
      longFlag,
      aliases
    })

    this._state.argumentsList.push({
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
      out['--'] = rest
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

    for (const value of this._state.argumentsList) {
      if (value.type === 'flag') {
        flags.push(value)
      } else {
        positionals.push(value)
      }
    }

    if (positionals.filter(p => p.inner._state.isMultiType).length > 1) {
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
      this._state.footerLines.push(line)
    } else {
      this._state.footerLines = [line]
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
      this._state.headerLines.push(line)
    } else {
      this._state.headerLines = [line]
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
  public async parseToResult (argString: string | string[], executeCommands = false): Promise<Result<ParseSuccess<TArgTypes, TCommandType>, ParseError | CoercionError[] | CommandError>> {
    this.opts.logger.internal(`Beginning parse of input '${argString}'`)

    const tokenResult = tokenise(Array.isArray(argString) ? argString.join(' ') : argString)

    if (!tokenResult.ok) {
      return tokenResult
    }

    const tokens = tokenResult.val

    const parseResult = parse(tokens, this._state, this.opts)
    if (!parseResult.ok) {
      return parseResult
    }

    const { command: parsedCommand } = parseResult.val

    // If we located a command, tell coerce to use its parser instead of our own
    let coercionResult
    if (parsedCommand.type === 'default' && !this._state.commands.empty() && this.opts.mustProvideCommand) {
      return Err(new CommandError('no command provided but one was expected'))
    }

    if (parsedCommand.type === 'user') {
      const commandParser = parsedCommand.internal.parser
      coercionResult = await coerce(
        parseResult.val,
        commandParser.opts,
        commandParser._state
      )
    } else {
      coercionResult = await coerce(
        parseResult.val,
        this.opts,
        this._state
      )
    }

    if (!coercionResult.ok) {
      return coercionResult
    }

    const { args, parsed: { command, rest } } = coercionResult.val

    // No command was found, just return the args
    if (command.type === 'default') {
      return Ok({
        mode: 'args',
        args: this.intoObject(args, rest?.value)
      })
    }

    // Builtin found, execute it and run, regardless of caller preference
    // builtins will always override the 'default' behaviour, so need to run
    if (command.type === 'builtin') {
      let executionResult

      try {
        await command.command.run(this, ...this.intoRaw(parseResult.val), command.trigger)
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
        await command.internal.inner.run(this.intoObject(args, rest?.value))
      } catch (err) {
        executionResult = err
      }

      return Ok({
        mode: 'command-exec',
        executionResult
      })
    }

    // Command was found, return it
    // @ts-expect-error erased commands can't resolve into concrete type
    return Ok({
      mode: 'command',
      parsedArgs: this.intoObject(args, rest?.value),
      command: command.internal.inner
    })
  }

  /**
   * Parses the provided arguments, printing the problems and exiting if the parse fails.
   * Callers can use {@link parseToResult} if control of parse failure behaviour is required.
   * @param argString - The arguments to parse
   * @param executeCommands - Whether to execute discovered commands, or return them
   * @returns The result of the parse, never an error
   */
  public async parse (argString: string | string[], executeCommands = false): Promise<ParseSuccess<TArgTypes, TCommandType>> {
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

  public clone (opts: ParserOpts = this.opts): Args<TArgTypes> {
    return new Args(opts, this._state)
  }
}
