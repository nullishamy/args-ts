
import assert from 'assert'
import { MinimalArgument, StoredParserOpts, defaultCommandOpts } from '../../src'
import { CoercedArguments, coerce } from '../../src/internal/parse/coerce'
import { tokenise } from '../../src/internal/parse/lexer'
import { ParsedArguments, parse } from '../../src/internal/parse/parser'
import { CoercedValue, InternalArgument, InternalCommand } from '../../src/internal/parse/types'
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
      _subcommands: subcommands ?? {},
      args: p => p,
      opts: {
        description: description ?? `${name} command description`,
        parserOpts: opts,
        ...defaultCommandOpts
      },
      run: p => p,
      runner: p => p,
      subcommand: p => ({} as any)
    },
    parser: ({} as any)
  }
}

export function makeInternalFlag (
  { isPrimary, long, short, inner }: {
    isPrimary: boolean
    long: string
    short?: string
    inner: MinimalArgument<CoercedValue>
  }): InternalArgument {
  return {
    type: 'flag',
    isLongFlag: isPrimary,
    longFlag: long,
    shortFlag: short,
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

  const parsed = parse(tokens.val, commandMap, opts)
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
      if (val.shortFlag) {
        acc.insert(val.shortFlag, val)
      }
    } else {
      acc.insert(val.key, val)
    }

    return acc
  }, new PrefixTree())

  const coerced = await coerce(parsed, opts, argMap, opts.defaultMiddlewares, [])
  if (!coerced.ok) {
    assert(Array.isArray(coerced.err))
    throw new Error(coerced.err.map(e => e.message).join('\n'))
  }

  return coerced.val
}
