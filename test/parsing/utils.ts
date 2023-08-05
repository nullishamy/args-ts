
import { MinimalArgument, ParserOpts } from '../../src'
import { tokenise } from '../../src/internal/parse/lexer'
import { parse, ParsedArguments } from '../../src/internal/parse/parser'
import { coerce, CoercedArguments } from '../../src/internal/parse/coerce'
import { CoercedValue, InternalArgument, InternalCommand } from '../../src/internal/parse/types'

export function makeInternalCommand (
  { name, opts, aliases, description, subcommands }: {
    name: string
    opts: ParserOpts
    description?: string
    aliases?: string[]
    subcommands?: Record<string, InternalCommand>
  }): InternalCommand {
  return {
    name,
    aliases: aliases ?? [],
    inner: {
      _subcommands: subcommands ?? {},
      args: p => p,
      opts: {
        description: description ?? `${name} command description`,
        parserOpts: opts
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
    isPrimary,
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

export function lexAndParse (argStr: string, opts: ParserOpts, commands: InternalCommand[]): ParsedArguments {
  const tokens = tokenise(argStr)
  if (!tokens.ok) {
    throw tokens.err
  }

  const commandMap = commands.reduce<Record<string, InternalCommand>>((acc, val) => {
    acc[val.name] = val
    return acc
  }, {})

  const parsed = parse(tokens.val, commandMap, opts)
  if (!parsed.ok) {
    throw parsed.err
  }

  return parsed.val
}

export async function parseAndCoerce (argStr: string, opts: ParserOpts, args: InternalArgument[]): Promise<CoercedArguments> {
  const parsed = lexAndParse(argStr, opts, [])
  const argMap = args.reduce<Record<string, InternalArgument>>((acc, val) => {
    if (val.type === 'flag') {
      acc[val.longFlag] = val
      if (val.shortFlag) {
        acc[val.shortFlag] = val
      }
    } else {
      acc[val.key] = val
    }

    return acc
  }, {})

  const coerced = await coerce(parsed, opts, argMap)
  if (!coerced.ok) {
    throw coerced.err
  }

  return coerced.val
}