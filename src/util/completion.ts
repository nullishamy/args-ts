import { Args } from '../args'

// TODO: Implement the completions
const SHELLS = {
  zsh: (parser: Args<unknown>) => 'zsh',
  fish: (parser: Args<unknown>) => 'nu',
  bash: (parser: Args<unknown>) => 'bash'
} as const

export function canCompleteShell (shell: string): shell is keyof typeof SHELLS {
  return Object.keys(SHELLS).includes(shell)
}

export function shellCompletion (shell: keyof typeof SHELLS, parser: Args<unknown>): string {
  const generator = SHELLS[shell]
  return generator(parser)
}
