import { Resolver } from './builder'
import { EnvironmentResolver } from './builder/'
import { Logger } from './util'

type MakePassedOpts<TOpts, TDefaults extends keyof TOpts> = (
  & Omit<TOpts, TDefaults>
  & Partial<Pick<TOpts, TDefaults>>
)

export interface StoredParserOpts {
  /**
   * The program name, shown in the help text.
   */
  programName: string
  /**
   * The program description, shown in the help text.
   */
  programDescription: string
  /**
   * The program version, shown in the help text.
   */
  programVersion: string
  /**
   * What to do when an unrecognised argument (not defined in the schema) is passed in the user input.
   */
  unrecognisedArgument: 'skip' | 'throw'
  /**
   * What to do when an unrecognised command (not defined in the schema) is passed into the user input.
   */
  unrecognisedCommand: 'into-positional' | 'throw'
  /**
   * Whether to enable the "rest" syntax:
   * When enabled, the values are collected
   * ```
   * --flag value -x -- the rest value goes here
   * => {
   *  flag: "value",
   *  x: true,
   *  rest: "the rest value goes here"
   * }
   * ```
   * Otherwise, an error is thrown.
   * @remarks When this is enabled, it will overwrite any arguments with the long flag of "rest"
   */
  restSyntax: 'collect' | 'error'
  /**
   * What to do when a user runs a deprecated command.
   */
  deprecatedCommands: 'error' | 'unknown-command'
  /**
   * Whether to enable the "key = value" syntax:
   * When enabled, the values are parsed as if normal syntax was used
   * ```
   * --flag=value -x
   * => {
   *  flag: "value",
   *  x: true,
   * }
   * ```
   * Otherwise, an error is thrown.
   */
  keyEqualsValueSyntax: boolean
  /**
   * Whether to enable the "short flag group" syntax
   * When enabled, groups of short flags are parsed as if they had all been specified individually
   * ```
   * -xyz -ab
   * => {
   *  x: true,
   *  y: true,
   *  z: true,
   *  a: true,
   *  b: true
   * }
   * ```
   * Otherwise, a group is treated as a single argument.
   * @remarks This feature makes the assumption that any short flag with length \> 1 is a group, even if it maps to a real short flag
   */
  shortFlagGroups: boolean
  /**
   * The prefix to use when falling back to environment variables for missing arguments.
   */
  environmentPrefix: string | undefined
  /**
   * Whether users must provide at least one command.
   */
  mustProvideCommand: boolean
  /**
   * The prefix to use for "negated boolean" syntax. An empty string means this feature is disabled.
   * ```
   * --no-flag --other-flag
   * => {
   *  flag: false,
   *  ['other-flag']: true
   * }
   * ```
   */
  negatedBooleanPrefix: string
  /**
   * The logger used by the library to provide diagnostic information.
   */
  logger: Logger
  /**
   * The resolvers used by default. These are copied into the {@link ArgState} when a {@link Args} parser is constructed.
   */
  resolvers: Resolver[]
}

/**
 * The default parser options to use. Merged with the opts passed to the {@link Args} constructor.
 * Subject to change. These are opinionated defaults.
*/
// Default to the loudest possible error modes, to alert us of programming errors
export const defaultParserOpts = {
  unrecognisedArgument: 'throw',
  unrecognisedCommand: 'into-positional',
  deprecatedCommands: 'error',
  restSyntax: 'collect',
  shortFlagGroups: true,
  keyEqualsValueSyntax: true,
  environmentPrefix: undefined,
  mustProvideCommand: true,
  negatedBooleanPrefix: 'no-',
  logger: new Logger('default'),
  resolvers: [
    new EnvironmentResolver('env')
  ] as Resolver[]
} as const satisfies Partial<StoredParserOpts>

/**
 * @see {@link StoredParserOpts} for documentation
 */
export type ParserOpts = MakePassedOpts<StoredParserOpts, keyof typeof defaultParserOpts>

export interface StoredCommandOpts {
  /**
   * The description of the command. Used in the help text.
   */
  description: string
  /**
   * The parser options used for the command's parser.
   */
  parserOpts: StoredParserOpts

  /**
   * Whether this command is deprecated or not.
   */
  deprecated: boolean
  /**
   * The message to show if this command is deprecated, the command is run, and the {@link ParserOpts.deprecatedCommands} option is set to "error"
   */
  deprecationMessage: string
  /**
   * Whether this command is hidden from the help text.
   */
  hidden: boolean
}

/**
 * The default command options to use. Merged with the opts passed to the {@link Command} constructor.
 * Subject to change. These are opinionated defaults.
*/
export const defaultCommandOpts = {
  deprecated: false,
  deprecationMessage: 'This command is deprecated.',
  hidden: false
} as const satisfies Partial<StoredCommandOpts>

// Must override `parserOpts` in `StoredCommandOpts` so users can pass their single value around
/**
 * @see {@link StoredCommandOpts} for documentation
 */
export type CommandOpts = (
  & Omit<StoredCommandOpts, 'parserOpts' | keyof typeof defaultCommandOpts>
  & Partial<Pick<StoredCommandOpts, keyof typeof defaultCommandOpts>>
  & {
    parserOpts: ParserOpts
  }
)

export interface ArgumentOpts {
  /**
   * What to do when many arguments are passed to a type that only expects a single argument
   */
  tooManyArgs: 'drop' | 'throw'
  /**
   * What to do when an argument is specified multiple times. This is only for *non* array arguments.
   * @see arrayMultipleDefinitions for array argument behaviour
   */
  tooManyDefinitions: 'drop' | 'throw' | 'overwrite'
  /**
   * What to do when an argument is specified multiple times. This is only for array arguments.
   * @see arrayMultipleDefinitions for single argument behaviour
   */
  arrayMultipleDefinitions: 'append' | 'drop' | 'throw' | 'overwrite'
}

/**
 * The default argument options to use. Set as the default when an {@link Argument} is constructed.
 * Subject to change. These are opinionated defaults.
*/
export const defaultArgumentOpts = {
  tooManyArgs: 'throw',
  tooManyDefinitions: 'throw',
  arrayMultipleDefinitions: 'append'
} as const satisfies Partial<ArgumentOpts>
