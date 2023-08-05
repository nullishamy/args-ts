import assert from 'assert'
import fc from 'fast-check'
import { tokenise } from '../src/internal/parse/lexer'

describe('Fuzzy testing', () => {
  it.only('', () => {
    const result = tokenise('--n "12"')
    assert(result.ok)
    console.log(result.val.toArray())
  })

  it('should give the same string out', async () => {
    await fc.assert(
      fc.asyncProperty(fc.string(), async (str) => {
        fc.pre(str.trim().length > 0)
        fc.pre(!(str.startsWith(' ') || str.endsWith(' ') || str.includes(' ')))

        const result = tokenise(`--string ${str}`)
        assert(result.ok)
        expect(result.val.toArray()).toStrictEqual([
          {
            type: 'flag-denotion'
          },
          {
            type: 'flag-denotion'
          },
          {
            lexeme: 'string',
            type: 'ident'
          },
          {
            type: 'value',
            userValue: str
          }
        ])
      })
    )
  })
})
