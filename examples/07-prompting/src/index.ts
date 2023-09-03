#!/usr/bin/env node

import { Args, ParserOpts, Resolver, a, util } from 'args.ts'
import readline from 'readline/promises'

export const parserOpts: ParserOpts = {
  programName: '07-prompting',
  programDescription: 'description',
  programVersion: 'v1'
}

// Provide a custom resolver for the username key.
// This does have the downside that it will *always* try and resolve the key
// whether the user provides the flag or not.
//
// If this distinction matters, use an Argument and override the `resolveDefault` method
// to control the behaviour dependant on specificity
class UsernamePromptResolver extends Resolver {
  private readonly rl: readline.Interface
  constructor (id: string) {
    super(id)

    this.rl = readline.createInterface({
      input: process.stdin, output: process.stdout
    })
  }

  async keyExists (key: string): Promise<boolean> {
    // We only care about resolving our username argument
    return key === 'username'
  }

  async resolveKey (): Promise<string> {
    const res = await this.rl.question('Enter username: ')
    this.rl.close()
    return res
  }
}

async function main (): Promise<void> {
  const parser = new Args(parserOpts)
    .arg(['--username'], a.string())
    .resolver(new UsernamePromptResolver('username'))

  const result = await parser.parse(util.makeArgs())

  if (result.mode !== 'args') {
    console.error('Did not get args back')
    return
  }

  console.log('Username:', result.args.username)
}

main().catch(console.error)
