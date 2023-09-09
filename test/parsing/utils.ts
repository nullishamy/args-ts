
import assert from 'assert'
import { ArgsState, Command, MinimalArgument, StoredParserOpts, defaultCommandOpts, defaultParserOpts } from '../../src'
import { CoercedArguments, coerce } from '../../src/internal/parse/coerce'
import { tokenise } from '../../src/internal/parse/lexer'
import { ParsedArguments, parse } from '../../src/internal/parse/parser'
import { CoercedValue, FlagAlias, InternalArgument, InternalCommand } from '../../src/internal/parse/types'
import { PrefixTree } from '../../src/internal/prefix-tree'

export function makeInternalCommand (
  { name, opts, aliases, description, subcommands }: {
    name: string
    opts: StoredParserOpts
    description?: string
    aliases?: string[]
    subcommands?: Record<string, InternalCommand>
  }): InternalCommand {
  return {
    name,
    aliases: aliases ?? [],
    isBase: true,
    inner: {
      log: defaultParserOpts.logger,
      _subcommands: subcommands ?? {},
      args: (p: any) => p,
      opts: {
        description: description ?? `${name} command description`,
        parserOpts: opts,
        ...defaultCommandOpts
      },
      run: (p: any) => p,
      runner: (p: any) => p,
      subcommand: (p: any) => ({} as any)
    } as unknown as Command,
    parser: ({} as any)
  }
}

export function makeInternalFlag (
  { isPrimary, long, aliases, inner }: {
    isPrimary: boolean
    long: string
    aliases?: FlagAlias[]
    inner: MinimalArgument<CoercedValue>
  }): InternalArgument {
  return {
    type: 'flag',
    isLongFlag: isPrimary,
    longFlag: long,
    aliases: aliases ?? [],
    inner
  }
}

export function makeInternalPositional (
  { key, index, inner }: {
    key: string
    index: number
    inner: MinimalArgument<CoercedValue>
  }): InternalArgument {
  return {
    type: 'positional',
    key,
    index,
    inner
  }
}

export function lexAndParse (argStr: string, opts: StoredParserOpts, commands: InternalCommand[]): ParsedArguments {
  const tokens = tokenise(argStr)
  if (!tokens.ok) {
    throw tokens.err
  }

  const commandMap = commands.reduce<PrefixTree<InternalCommand>>((acc, val) => {
    acc.insert(val.name, val)
    return acc
  }, new PrefixTree())

  const state: ArgsState = {
    arguments: new PrefixTree(),
    argumentsList: [],
    commands: commandMap,
    commandsList: commands,
    builtins: [],
    resolvers: opts.resolvers,
    footerLines: [],
    headerLines: []
  }

  const parsed = parse(tokens.val, state, opts)
  if (!parsed.ok) {
    throw parsed.err
  }

  return parsed.val
}

export async function parseAndCoerce (argStr: string, opts: StoredParserOpts, args: InternalArgument[]): Promise<CoercedArguments> {
  const parsed = lexAndParse(argStr, opts, [])
  const argMap = args.reduce<PrefixTree<InternalArgument>>((acc, val) => {
    if (val.type === 'flag') {
      acc.insert(val.longFlag, val)
      if (val.aliases) {
        val.aliases.forEach(a => acc.insert(a.value, val))
      }
    } else {
      acc.insert(val.key, val)
    }

    return acc
  }, new PrefixTree())

  const state: ArgsState = {
    arguments: argMap,
    argumentsList: args,
    commands: new PrefixTree(),
    commandsList: [],
    builtins: [],
    resolvers: opts.resolvers,
    footerLines: [],
    headerLines: []
  }

  const coerced = await coerce(parsed, opts, state)
  if (!coerced.ok) {
    assert(Array.isArray(coerced.err))
    throw new Error(coerced.err.map(e => e.message).join('\n'))
  }

  return coerced.val
}
