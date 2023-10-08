#!/usr/bin/env node
/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { Args, Command, CommandRunner, ParserOpts, util } from 'args.ts'

export const parserOpts: ParserOpts = {
  programName: '08-command-context',
  programDescription: 'description',
  programVersion: 'v1'
}

interface Context {
  value: string
}

abstract class BaseCommand extends Command {
  abstract runWithContext: CommandRunner<this, [Context]>

  run = (): never => {
    throw new TypeError('run called, expected runWithContext')
  }
}

class ConcreteCommand extends BaseCommand {
  runWithContext: CommandRunner<this, [Context]> = this.runner(async (args, context) => {
    console.log('Ran with context:', context)
  })

  args = (parser: Args<{}>) => {
    return parser
  }
}

async function main (): Promise<void> {
  const parser = new Args(parserOpts)
    .command(['cmd'], new ConcreteCommand({
      parserOpts,
      description: 'command'
    }))

  const result = await parser.parse(util.makeArgs())

  if (result.mode !== 'command') {
    console.error('Did not get command back')
    return
  }

  const command = result.command
  await command.runWithContext({}, {
    value: 'the context value!'
  })
}

main().catch(console.error)
