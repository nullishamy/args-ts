import { StoredParserOpts, defaultParserOpts } from '../src'

const defaults = {
  ...defaultParserOpts,
  logger: defaultParserOpts.logger.setLevel('warn')
}

export const parserOpts: StoredParserOpts = {
  programName: 'program-name',
  programDescription: 'program description',
  programVersion: 'v1',
  ...defaults
} as const
