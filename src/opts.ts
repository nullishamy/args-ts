type MakePassedOpts<TOpts, TDefaults extends keyof TOpts> = (
  & Omit<TOpts, TDefaults>
  & Partial<Pick<TOpts, TDefaults>>
)

export interface StoredParserOpts {
  programName: string
  programDescription: string
  unrecognisedArgument: 'skip' | 'throw'
  tooManyArgs: 'drop' | 'throw'
  tooManyValues: 'drop' | 'throw'
  deprecatedCommands: 'error' | 'unknown-command'
  keyEqualsValueSyntax: boolean
  shortFlagGroups: boolean
  environmentPrefix: string | undefined
}

// Default to the loudest possible error modes, to alert us of programming errors
export const defaultParserOpts = {
  unrecognisedArgument: 'throw',
  tooManyArgs: 'throw',
  tooManyValues: 'throw',
  deprecatedCommands: 'error',
  shortFlagGroups: true,
  keyEqualsValueSyntax: true,
  environmentPrefix: undefined
} as const satisfies Partial<StoredParserOpts>

export type ParserOpts = MakePassedOpts<StoredParserOpts, keyof typeof defaultParserOpts>

export interface StoredCommandOpts {
  description: string
  parserOpts: StoredParserOpts

  deprecated: boolean
  deprecationMessage: string
  hidden: boolean
}

export const defaultCommandOpts = {
  deprecated: false,
  deprecationMessage: 'This command is deprecated.',
  hidden: false
} as const satisfies Partial<StoredCommandOpts>

// Must override `parserOpts` in `StoredCommandOpts` so users can pass their single value around
export type CommandOpts = (
  & Omit<StoredCommandOpts, 'parserOpts' | keyof typeof defaultCommandOpts>
  & Partial<Pick<StoredCommandOpts, keyof typeof defaultCommandOpts>>
  & {
    parserOpts: ParserOpts
  }
)
