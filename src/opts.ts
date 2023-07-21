export interface ParserOpts {
  programName: string
  programDescription: string
  unknownArgBehaviour: 'skip' | 'throw'
  excessArgBehaviour: 'drop' | 'throw'
}
export interface CommandOpts {
  description: string
  parserOpts: ParserOpts
}
