import { Result } from '../internal/result'

export function exitOnFailure <T, E> (result: Result<T, E>, message?: string, code = 1): T {
  if (!result.ok) {
    if (message) {
      console.error(message)
    } else {
      console.error(result.err)
    }
    process.exit(code)
  }

  return result.val
}
