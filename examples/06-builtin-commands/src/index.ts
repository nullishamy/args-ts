#!/usr/bin/env node

import { Args, ParserOpts, a, builtin } from 'args.ts'

export const parserOpts: ParserOpts = {
  programName: '06-builtin-commands',
  programDescription: 'description',
  programVersion: 'v1'
}

async function main (): Promise<void> {
  const parser = new Args(parserOpts)
    .arg(['--sample'], a.string())
    .builtin(builtin.help())

  const result = await parser.parse('--sample --help')
  // Won't return the args we got, will instead run the builtin and give us whatever that returned
  // Builtins are treated as regular commands, so the mode is command-exec
  // The help builtin returns nothing, so we get undefined

  if (result.mode !== 'command-exec') {
    console.error('Builtin did not execute')
    return
  }

  console.log('Execution: ', result.executionResult) // undefined
}

main().catch(console.error)
