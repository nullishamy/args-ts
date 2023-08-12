import { StoredParserOpts, defaultParserOpts } from '../src'

export const parserOpts: StoredParserOpts = {
  programName: 'program-name',
  programDescription: 'program description',
  ...defaultParserOpts
} as const
