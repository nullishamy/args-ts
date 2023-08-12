import { StoredParserOpts } from '../src'

export const parserOpts: StoredParserOpts = {
  programName: 'program-name',
  programDescription: 'program description',
  unrecognisedArgument: 'throw',
  tooManyArgs: 'throw',
  tooManyValues: 'throw',
  deprecatedCommands: 'error',
  shortFlagGroups: true,
  keyEqualsValueSyntax: true,
  environmentPrefix: undefined,
  mustProvideCommand: true,
  tooManyDefinitions: 'throw',
  arrayMultipleDefinitions: 'append'
} as const
