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
  if (!result.ok) {
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    throw new Error(result.toString())
  }
  assert(result.val.mode === 'args', 'result was not of mode args')
  return result.val.args
}

export async function runCommandExecution (parser: Args<unknown>, argString: string): Promise<unknown> {
  const result = await parser.parse(argString)
  if (!result.ok) {
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    throw new Error(result.toString())
  }
  assert(result.val.mode === 'command', 'result was not of mode command')
  return await result.val.command.run(result.val.parsedArgs)
}
