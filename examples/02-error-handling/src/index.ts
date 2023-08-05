import { Args, ParserOpts, a, util } from 'args.ts'

export const parserOpts: ParserOpts = {
  programName: '02-error-handling',
  programDescription: '',
  unknownArgBehaviour: 'throw',
  excessArgBehaviour: 'throw'
}

async function main (): Promise<void> {
  const parser = new Args(parserOpts)
    .arg(['--boolean'], a.bool())
    .arg(['--number'], a.number())

  // args.ts provides helpers for various mundane tasks, such as exiting the program if the parse fails
  const args = util.exitOnFailure(await parser.parse('--boolean --number test'))
  console.log(args) // <unreached>
}

main().catch(console.error)
