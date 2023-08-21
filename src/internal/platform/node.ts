import { Platform } from '.'

interface ElectronProcess extends NodeJS.Process {
  defaultApp?: boolean
  versions: NodeJS.ProcessVersions & {
    electron: string
  }
}

export const nodePlatform: Platform = {
  getEnv: (key) => process.env[key],
  setEnv: (key, value) => {
    process.env[key] = value
  },
  argv: () => process.argv,
  process: () => ({
    versions: process.versions,
    exit: process.exit,
    isElectron: () => {
      // process.versions.electron is either set by electron, or undefined
      // see https://github.com/electron/electron/blob/main/docs/api/process.md#processversionselectron-readonly
      return !!(process as ElectronProcess).versions.electron
    },
    isBundledElectron: () => {
      // process.defaultApp is either set by electron in an electron unbundled app, or undefined
      // see https://github.com/electron/electron/blob/main/docs/api/process.md#processdefaultapp-readonly
      return nodePlatform.process().isElectron() && !(process as ElectronProcess).defaultApp
    }
  })
}
