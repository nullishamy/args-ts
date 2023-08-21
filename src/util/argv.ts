// This file is licensed under the MIT license (LICENSE.MIT.md)
// Copyright 2010 James Halliday (mail@substack.net); Modified work Copyright 2014 Contributors (ben@npmjs.com)

import { currentPlatform } from '../internal/platform'

function getProcessArgvBinIndex (): number {
  // The binary name is the first command line argument for:
  // - bundled Electron apps: bin argv1 argv2 ... argvn
  if (currentPlatform().process().isBundledElectron()) return 0
  // or the second one (default) for:
  // - standard node apps: node bin.js argv1 argv2 ... argvn
  // - unbundled Electron apps: electron bin.js argv1 arg2 ... argvn
  return 1
}

/**
 * Strips out the filename from argv, based on whether the running app is electron or not.
 *
 * Standard node apps: `node bin.js argv1 argv2 ... argvn` converts to `argv1 argv2 ... argvn`
 *
 * Bundled Electron apps: `bin argv1 argv2 ... argvn` converts to `argv1 argv2 ... argvn`
 * @param argv - the argv to process from (defaults to process.argv)
 * @returns the arguments without the filename
 */
export function makeArgs (argv?: string[]): string[] {
  return (argv ?? currentPlatform().argv()).slice(getProcessArgvBinIndex() + 1)
}

export function fileName (argv?: string[]): string {
  return (argv ?? currentPlatform().argv())[getProcessArgvBinIndex()]
}
