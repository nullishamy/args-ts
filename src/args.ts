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

export class Args<TArgTypes extends DefaultArgTypes = DefaultArgTypes> {
  public readonly opts: StoredParserOpts
  public readonly _state: ArgsState

  private positionalIndex = 0

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

  public resolver (resolver: Resolver): Args<TArgTypes> {
    this._state.resolvers.push(resolver)
    return this
  }

  public builtin (builtin: Builtin): Args<TArgTypes> {
    this._state.builtins.push(builtin)
    return this
  }

  public command<TName extends string, TCommand extends Command> (
    [name, ...aliases]: [`${TName}`, ...string[]],
    command: TCommand,
    inherit = false
  ): Args<TArgTypes> {
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
    this._state.arguments.insert(slicedKey, {
      type: 'positional',
      inner: declaration,
      key: slicedKey,
      index
    })

    this._state.argumentsList.push({
      type: 'positional',
      inner: declaration,
      key: slicedKey,
      index
    })

    // @ts-expect-error same inference problem as arg()
    return this
  }

  public arg<TArg extends CoercedValue, TLong extends string> (
    [_longFlag, ..._aliases]: [`--${TLong}`, ...Array<`-${string}` | `--${string}`>],
    declaration: MinimalArgument<TArg>
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
        inner: declaration,
        longFlag,
        aliases
      })
    }

    this._state.arguments.insert(longFlag, {
      type: 'flag',
      isLongFlag: true,
      inner: declaration,
      longFlag,
      aliases
    })

    this._state.argumentsList.push({
      type: 'flag',
      isLongFlag: true,
      inner: declaration,
      longFlag,
      aliases
    })

    // @ts-expect-error can't infer this because of weird subtyping, not a priority
    return this
  }

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

    for (const value of this._state.argumentsList) {
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
      this._state.footerLines.push(line)
    } else {
      this._state.footerLines = [line]
    }

    return this
  }

  public header (line: string, append = true): Args<TArgTypes> {
    if (append) {
      this._state.headerLines.push(line)
    } else {
      this._state.headerLines = [line]
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
    return Ok({
      mode: 'command',
      parsedArgs: this.intoObject(args, rest?.value),
      command: command.internal.inner
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

  public clone (opts: ParserOpts = this.opts): Args<TArgTypes> {
    return new Args(opts, this._state)
  }
}
