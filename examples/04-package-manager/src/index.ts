#!/usr/bin/env node

// Command arguments rely on inference to work properly.
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { Args, ParserOpts, a, Command, util } from 'args.ts'

export const parserOpts: ParserOpts = {
  programName: '04-package-manager',
  programDescription: 'package manager utility',
  programVersion: 'v1'
}

class Query extends Command {
  // args.ts is designed to be extensible and configurabl so unfortunately you must manually pass up parser opts.
  // This is made easy if you declare them once and just pass them around, as shown below
  constructor (opts: ParserOpts) {
    super({
      description: 'query the package database',
      parserOpts: opts
    })
  }

  args = (parser: Args<unknown>) => parser
    .arg(['--search', '-s'],
      a.string()
        .array()
        .optional()
        .conflictsWith('--info')
        .describe('search locally installed packages')
    )
    .arg(['--info', '-i'],
      a.string()
        .array()
        .optional()
        .conflictsWith('--search')
        .describe('view package information')
    )

  run = this.runner(async args => {
    if (args.info) {
      console.log('Fetching information for', args.info.join(', '), '...')
      return
    }

    if (args.search) {
      console.log('Searcing the local DB for', args.search.join(', '), '...')
      return
    }

    console.log('Displaying all installed packages')
  })
}

class Sync extends Command {
  constructor (opts: ParserOpts) {
    super({
      description: 'sync packages',
      parserOpts: opts
    })
  }

  args = (parser: Args<unknown>) => parser
    .arg(['--search', '-s'],
      a.string()
        .array()
        .conflictsWith('--info')
        .optional()
        .describe('search remote repositoriese')
    )
    .arg(['--info', '-i'],
      a.string()
        .array()
        .optional()
        .conflictsWith('--search')
        .describe('view package information')
    )
    .positional('<packages>',
      a.string()
        .array()
        .optional()
        .requireUnlessPresent('--search')
    )

  run = this.runner(async args => {
    if (args.search) {
      console.log('Searching for', args.search.join(', '), '...')
      return
    }

    if (args.info) {
      console.log('Fetching information for', args.info.join(', '), '...')
      return
    }

    if (args.packages) {
      console.log('Installing', args.packages.join(', '), '...')
    }
  })
}

async function main (): Promise<void> {
  const parser = new Args(parserOpts)
    .arg(['--help'], a.bool())
    .command(['query'], new Query(parserOpts))
    .command(['sync'], new Sync(parserOpts))

  const result = await parser.parse(util.makeArgs(), true)

  if (result.mode === 'args') {
    if (result.args.help) {
      console.log(parser.help())
    }
    return
  }

  if (result.mode === 'command') {
    console.error('internal error, commands did not run')
    process.exit(1)
  }

  console.log(`Command executed: ${JSON.stringify(result.executionResult)}`)
}

main().catch(console.error)
