export interface Platform {
  getEnv: (key: string) => string | undefined
  setEnv: (key: string, value: string) => void
  argv: () => string[]
  process: () => {
    versions: Record<string, string | undefined>
    isElectron: () => boolean
    isBundledElectron: () => boolean
    exit: (code: number) => never
  }
}

let _platform: Platform | undefined

export function usePlatform (platform: Platform): void {
  _platform = platform
}

export function currentPlatform (): Platform {
  if (!_platform) {
    throw new Error('no platform setup')
  }

  return _platform
}

export * from './node'
