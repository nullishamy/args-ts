import { ParserOpts } from '../src'

export const parserOpts: ParserOpts = {
  programName: 'program-name',
  programDescription: 'program description',
  unknownArgBehaviour: 'throw',
  excessArgBehaviour: 'throw'
} as const
