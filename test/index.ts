import { Opts } from '../src'

export const parserOpts: Opts = {
  name: 'program-name',
  description: 'program description',
  unknownArgBehaviour: 'throw',
  excessArgBehaviour: 'throw'
} as const
