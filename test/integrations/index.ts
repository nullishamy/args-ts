import assert from 'assert'
import { Args } from '../../src'
import { ParserOpts } from '../../src/opts'

export const parserOpts: ParserOpts = {
  programName: 'program-name',
  programDescription: 'program description',
  unknownArgBehaviour: 'throw',
  excessArgBehaviour: 'throw'
} as const

export async function runArgsExecution <T> (parser: Args<T>, argString: string): Promise<T> {
  const result = await parser.parse(argString)
  if (!result.ok) {
    throw result.err
  }
  assert(result.val.mode === 'args', `result was not of mode args, got ${result.val.mode}`)
  return result.val.args
}

export async function runCommandExecution (parser: Args<unknown>, argString: string): Promise<unknown> {
  const result = await parser.parse(argString)
  if (!result.ok) {
    throw result.err
  }
  assert(result.val.mode === 'command', `result was not of mode command, got ${result.val.mode}`)
  return await result.val.command.run(result.val.parsedArgs)
}
