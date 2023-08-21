import { Args } from '../args'

// TODO: Implement the completions
const SHELLS = {
  zsh: (parser: Args<{}>) => 'zsh',
  fish: (parser: Args<{}>) => 'nu',
  bash: (parser: Args<{}>) => 'bash'
} as const

export function canCompleteShell (shell: string): shell is keyof typeof SHELLS {
  return Object.keys(SHELLS).includes(shell)
}

export function shellCompletion (shell: keyof typeof SHELLS, parser: Args<{}>): string {
  const generator = SHELLS[shell]
  return generator(parser)
}
