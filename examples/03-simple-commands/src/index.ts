// Command arguments rely on inference to work properly.
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { Args, ParserOpts, a, Command, util } from 'args.ts'

export const parserOpts: ParserOpts = {
  programName: '03-simple-commands',
  programDescription: 'program description',
  programVersion: 'v1'
}

class MyCommand extends Command {
  // args.ts is designed to be extensible and configurabl so unfortunately you must manually pass up parser opts.
  // This is made easy if you declare them once and just pass them around, as shown below
  constructor (opts: ParserOpts) {
    super({
      description: 'my command',
      parserOpts: opts
    })
  }

  args = (parser: Args<unknown>) =>
    parser.arg(['--cmd-arg'], a.string())

  run = this.runner(async args => {
    console.log('MyCommand got:', args['cmd-arg'])
    return 'result from MyCommand'
  })
}

async function main (): Promise<void> {
  // Names are passed in at the parser level as to provide a cleaner API for conditionals, custom aliasing, etc
  const parser = new Args(parserOpts)
    .command(['cmd'], new MyCommand(parserOpts))

  // args.ts can run your commands for you, provided the second argument is `true` when calling parse()
  // `parse('...', true)`, however you can also run it yourself, after it is fully parsed and validated:
  const result = util.exitOnFailure(await parser.parse('cmd --cmd-arg hello'))

  if (result.mode !== 'command') {
    console.error(`args.ts should have given us the command information back. got ${result.mode}`)
    return
  }

  const execution = await result.command.run(result.parsedArgs)
  console.log(`Command executed: ${execution}`)
}

main().catch(console.error)
