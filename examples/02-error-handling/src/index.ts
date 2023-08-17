import { Args, ParserOpts, a } from 'args.ts'

export const parserOpts: ParserOpts = {
  programName: '02-error-handling',
  programDescription: '',
  programVersion: 'v1'
}

async function main (): Promise<void> {
  const parser = new Args(parserOpts)
    .arg(['--boolean'], a.bool())
    .arg(['--number'], a.number())

  // The default `parse` function from args.ts will exit the program (and print the help)
  // if it could not parse the input. If more fine grain control of errors is required, use `parseToResult`.
  const args = await parser.parse('--boolean --number test')
  console.log(args) // <unreached>
}

main().catch(console.error)
