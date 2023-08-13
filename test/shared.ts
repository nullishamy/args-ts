import { StoredParserOpts, defaultParserOpts } from '../src'

export const parserOpts: StoredParserOpts = {
  programName: 'program-name',
  programDescription: 'program description',
  programVersion: 'v1',
  ...defaultParserOpts
} as const
