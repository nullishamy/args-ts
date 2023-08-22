import fsp from 'fs/promises'
import path from 'path'
import { execSync } from 'child_process'

describe('Example compilation', () => {
  it('can compile the examples', async () => {
    if (!process.env.GITHUB_ACTIONS) {
      return
    }

    const dir = path.join(__dirname, '..', 'examples')
    const examples = await fsp.readdir(dir)

    for (const example of examples) {
      console.time(example)
      execSync(`npm run build --prefix ${path.join(dir, example)}`)
      console.timeEnd(example)
    }
  })
})
