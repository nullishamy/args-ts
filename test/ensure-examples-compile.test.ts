import fsp from 'fs/promises'
import path from 'path'
import { execSync } from 'child_process'

interface ExecError {
  status: number
  signal: null
  output: string[]
  pid: number
  stdout: string
  stderr: string
}

describe('Example compilation', () => {
  it('can compile the examples', async () => {
    const dir = path.join(__dirname, '..', 'examples')
    const examples = await fsp.readdir(dir)

    for (const example of examples) {
      console.time(example)

      try {
        execSync(`npm run build --prefix ${path.join(dir, example)}`, {
          encoding: 'utf-8'
        })
      } catch (_err) {
        const err = _err as ExecError
        console.error('Example', example, 'failed to compile:', err.stdout)
      }

      console.timeEnd(example)
    }
  })
})
