import { ArgError, ParseError } from '../error'
import { Result } from '../internal/result'

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
