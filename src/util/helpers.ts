import { ArgError, ParseError } from '../error'
import { Result } from '../internal/result'

/**
 * Checks if {@link result} is an error, and exits with {@link code} after printing {@link message} if it is.
 * Otherwise, returns the success value.
 * @param result - the result to check
 * @param message - the message to print
 * @param code - the exit code
 * @returns T - the successful result value
 */
export function exitOnFailure <T, E extends ArgError> (result: Result<T, E>, message?: string, code = 1): T {
  if (!result.ok) {
    if (message) {
      console.error(message)
    }

    console.error()
    const { err } = result
    if (err instanceof ParseError) {
      console.error('error whilst parsing', '\n', err.problem, '\n', err.argString)
    } else {
      console.error(result.err)
    }

    process.exit(code)
  }

  return result.val
}
