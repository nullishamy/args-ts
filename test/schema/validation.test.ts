/* eslint-disable @typescript-eslint/quotes */
import assert from 'assert'
import { parserOpts } from '.'
import { a, Args } from '../../src'

describe('Schema validation', () => {
  it('rejects schemas with multiple multi-type positional arguments', () => {
    const parser = new Args(parserOpts)
      .positional('<pos1>', a.string().array())
      .positional('<pos2>', a.string().array())

    const result = parser.validate()

    assert(!result.ok, 'schema validation passed')
    expect(result.err).toMatchInlineSnapshot(`[Error: multiple multi-type positionals found]`)
  })

  it('allows schemas with a single positional argument', () => {
    const parser = new Args(parserOpts)
      .positional('<pos1>', a.string().array())

    const result = parser.validate()

    assert(result.ok, 'schema validation failed')
  })
})
