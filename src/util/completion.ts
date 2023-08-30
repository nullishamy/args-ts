import { Args } from '../args'

// TODO: Implement the completions
const SHELLS = {
  zsh: (parser: Args<{}>) => 'zsh',
  fish: (parser: Args<{}>) => 'nu',
  bash: (parser: Args<{}>) => 'bash'
} as const

/**
 * Check if we have a known completion function for the given shell.
 * Primarily useful for type predicate usage, but also valuable for JavaScript users.
 * @param shell - The shell to check
 * @returns Whether we can provided completions for the shell
 */
export function canCompleteShell (shell: string): shell is keyof typeof SHELLS {
  return Object.keys(SHELLS).includes(shell)
}

/**
 * Generate shell completion for the provided shell, based on the provided parser configuration.
 * This function will not validate whether a shell is known to us or not. Use {@link canCompleteShell} for this.
 * @param shell - The shell to genrate completions for
 * @param parser - The parser configuration to use
 * @returns The generated completion string
 */
export function shellCompletion (shell: keyof typeof SHELLS, parser: Args<{}>): string {
  const generator = SHELLS[shell]
  return generator(parser)
}
