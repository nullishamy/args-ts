import { a } from '../../src'
import { parserOpts } from '../shared'
import { makeInternalFlag, makeInternalPositional, parseAndCoerce } from './utils'

describe('Coercion tests', () => {
  it('can coerce a number argument', async () => {
    const flag = makeInternalFlag({
      isPrimary: true,
      long: 'number',
      inner: a.number()
    })

    const coerced = await parseAndCoerce('--number 1', parserOpts, [flag])

    expect(coerced.parsed.command).toEqual({
      type: 'default'
    })
    expect(coerced.args.get(flag)).toEqual({
      isMulti: false,
      coerced: 1,
      raw: '1'
    })
  })

  it('can coerce a boolean argument', async () => {
    const flag = makeInternalFlag({
      isPrimary: true,
      long: 'bool',
      inner: a.bool()
    })

    const coerced = await parseAndCoerce('--bool true', parserOpts, [flag])

    expect(coerced.parsed.command).toEqual({
      type: 'default'
    })
    expect(coerced.args.get(flag)).toEqual({
      isMulti: false,
      coerced: true,
      raw: 'true'
    })
  })

  it('can coerce positional strings', async () => {
    const flag = makeInternalPositional({
      index: 0,
      key: 'string',
      inner: a.string()
    })

    const coerced = await parseAndCoerce('helloworld', parserOpts, [flag])

    expect(coerced.parsed.command).toEqual({
      type: 'default',
      key: 'helloworld'
    })
    expect(coerced.args.get(flag)).toEqual({
      isMulti: false,
      coerced: 'helloworld',
      raw: 'helloworld'
    })
  })

  it('can coerce an unquoted string argument', async () => {
    const flag = makeInternalFlag({
      isPrimary: true,
      long: 'string',
      inner: a.string()
    })

    const coerced = await parseAndCoerce('--string helloworld', parserOpts, [flag])

    expect(coerced.parsed.command).toEqual({
      type: 'default'
    })
    expect(coerced.args.get(flag)).toEqual({
      isMulti: false,
      coerced: 'helloworld',
      raw: 'helloworld'
    })
  })

  it('can coerce a quoted string argument', async () => {
    const flag = makeInternalFlag({
      isPrimary: true,
      long: 'string',
      inner: a.string()
    })

    const coerced = await parseAndCoerce('--string "hello world"', parserOpts, [flag])

    expect(coerced.parsed.command).toEqual({
      type: 'default'
    })
    expect(coerced.args.get(flag)).toEqual({
      isMulti: false,
      coerced: 'hello world',
      raw: 'hello world'
    })
  })
})
