/* eslint-disable @typescript-eslint/quotes */
import assert from 'assert'
import { parserOpts } from '../shared'
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

  it('rejects long flags without preceding --', () => {
    const parser = new Args(parserOpts)

    expect(() => {
      // @ts-expect-error we are testing runtime validation, for JS users, or people who dont like playing by the rules
      parser.arg(['-1'], a.string())
    }).toThrowErrorMatchingInlineSnapshot(`"long flags must start with '--', got '-1'"`)
  })

  it('rejects positionals not prefixed by <', () => {
    const parser = new Args(parserOpts)

    expect(() => {
      // @ts-expect-error we are testing runtime validation, for JS users, or people who dont like playing by the rules
      parser.positional('1test>', a.string())
    }).toThrowErrorMatchingInlineSnapshot(`"keys must start with < and end with >, got 1test>"`)
  })

  it('rejects positionals not suffixed by >', () => {
    const parser = new Args(parserOpts)

    expect(() => {
      // @ts-expect-error we are testing runtime validation, for JS users, or people who dont like playing by the rules
      parser.positional('<test1', a.string())
    }).toThrowErrorMatchingInlineSnapshot(`"keys must start with < and end with >, got <test1"`)
  })

  it('rejects short flags without preceding -', () => {
    const parser = new Args(parserOpts)

    expect(() => {
      // @ts-expect-error we are testing runtime validation, for JS users, or people who dont like playing by the rules
      parser.arg(['--flag', '1'], a.string())
    }).toThrowErrorMatchingInlineSnapshot(`"short flags must start with '-', got '1'"`)
  })

  it('rejects long flags that do not have a valid ID', () => {
    const parser = new Args(parserOpts)

    expect(() => {
      parser.arg(['--1'], a.string())
    }).toThrowErrorMatchingInlineSnapshot(`"long flags must match '--abcdef...' got '--1'"`)
  })

  it('rejects short flags that do not have a valid ID', () => {
    const parser = new Args(parserOpts)

    expect(() => {
      parser.arg(['--flag', '-1'], a.string())
    }).toThrowErrorMatchingInlineSnapshot(`"short flags must match '-abcdef...' got '-1'"`)
  })

  it('rejects duplicate long flags', () => {
    const parser = new Args(parserOpts)
      .arg(['--flag'], a.string())

    expect(() => {
      parser.arg(['--flag'], a.string())
    }).toThrowErrorMatchingInlineSnapshot(`"duplicate long flag '--flag'"`)
  })

  it('rejects duplicate short flags', () => {
    const parser = new Args(parserOpts)
      .arg(['--flag', '-f'], a.string())

    expect(() => {
      parser.arg(['--flag2', '-f'], a.string())
    }).toThrowErrorMatchingInlineSnapshot(`"duplicate short flag '-f'"`)
  })

  it('rejects non-string input', async () => {
    const parser = new Args(parserOpts)
      .arg(['--flag', '-f'], a.string())

    const result = await parser.parse(undefined as any)
    expect(result).toMatchInlineSnapshot(`
{
  "err": [TypeError: expected 'string', got undefined (undefined)],
  "ok": false,
}
`)
  })
})
