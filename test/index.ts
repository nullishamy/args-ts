import assert from 'assert'
import { Args } from '../src'
import { ParserOpts } from '../src/opts'

export const parserOpts: ParserOpts = {
  programName: 'program-name',
  programDescription: 'program description',
  unknownArgBehaviour: 'throw',
  excessArgBehaviour: 'throw'
} as const

export async function runArgsExecution <T> (parser: Args<T>, argString: string): Promise<T> {
  const result = await parser.parse(argString)
  assert(result.mode === 'args', 'result was not of mode args')
  return result.args
}

export async function runCommandExecution (parser: Args<unknown>, argString: string): Promise<unknown> {
  const result = await parser.parse(argString)
  assert(result.mode === 'command', 'result was not of mode command')
  return await result.command.run(result.parsedArgs)
}
