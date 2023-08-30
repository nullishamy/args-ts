#!/usr/bin/env node

import { Args, ParserOpts, a, util, Resolver } from 'args.ts'

export const parserOpts: ParserOpts = {
  programName: '05-application-config',
  programDescription: 'description',
  programVersion: 'v1'
}

class UserConfigResolver extends Resolver {
  private data: { [k: string]: string | undefined } = {}

  async load (): Promise<this> {
    // In a real application, you would load this from disk, or another external source
    this.data = {
      username: 'test-user',
      password: 'super-secret'
    }
    return this
  }

  keyExists (key: string): boolean {
    return this.data[key] !== undefined
  }

  resolveKey (key: string): string {
    const value = this.data[key]

    if (value === undefined) {
      throw new TypeError()
    }

    return value
  }
}

async function main (): Promise<void> {
  const parser = new Args(parserOpts)
    .arg(['--username'], a.string())
    .arg(['--password'], a.string())
    // The string here is used for internal identification of the middleware
    .resolver(await (new UserConfigResolver('user-config')).load())

  const result = await parser.parse(util.makeArgs(), true)

  if (result.mode === 'args') {
    console.log('username:', result.args.username)
    console.log('password:', result.args.password)
  }
}

main().catch(console.error)
