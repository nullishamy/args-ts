// This file is licensed under the MIT license (LICENSE.MIT.md)
// Copyright 2010 James Halliday (mail@substack.net); Modified work Copyright 2014 Contributors (ben@npmjs.com)

function getProcessArgvBinIndex (): number {
  // The binary name is the first command line argument for:
  // - bundled Electron apps: bin argv1 argv2 ... argvn
  if (isBundledElectronApp()) return 0
  // or the second one (default) for:
  // - standard node apps: node bin.js argv1 argv2 ... argvn
  // - unbundled Electron apps: electron bin.js argv1 arg2 ... argvn
  return 1
}

function isBundledElectronApp (): boolean {
  // process.defaultApp is either set by electron in an electron unbundled app, or undefined
  // see https://github.com/electron/electron/blob/main/docs/api/process.md#processdefaultapp-readonly
  return isElectronApp() && !(process as ElectronProcess).defaultApp
}

function isElectronApp (): boolean {
  // process.versions.electron is either set by electron, or undefined
  // see https://github.com/electron/electron/blob/main/docs/api/process.md#processversionselectron-readonly
  return !!(process as ElectronProcess).versions.electron
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
export function makeArgs (argv: string[] = process.argv): string[] {
  return argv.slice(getProcessArgvBinIndex() + 1)
}

export function binFile (argv: string[] = process.argv): string {
  return argv[getProcessArgvBinIndex()]
}

interface ElectronProcess extends NodeJS.Process {
  defaultApp?: boolean
  versions: NodeJS.ProcessVersions & {
    electron: string
  }
}
