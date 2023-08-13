import { Args, ParserOpts, a } from 'args.ts'

export const parserOpts: ParserOpts = {
  programName: '01-basic-flags',
  programDescription: 'program description',
  programVersion: 'v1'
}

async function main (): Promise<void> {
  const parser = new Args(parserOpts)
    // Booleans are optional by default, and will default to `false` when unspecified and `true` when specified.
    .arg(['--boolean'], a.bool())

  const unspecified = await parser.parse('')
  console.log(unspecified) // { boolean: false }

  const specified = await parser.parse('--boolean')
  console.log(specified) // { boolean: true }

  // When a value is passed along with the boolean, it is coerced and used
  const falseGiven = await parser.parse('--boolean false')
  console.log(falseGiven) // { boolean: false }

  const trueGiven = await parser.parse('--boolean true')
  console.log(trueGiven) // { boolean: true }
}

main().catch(console.error)
