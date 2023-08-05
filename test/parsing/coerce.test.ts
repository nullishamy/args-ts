import { a } from '../../src'
import { makeInternalFlag, parseAndCoerce } from './utils'

describe('Coercion tests', () => {
  const opts = {
    excessArgBehaviour: 'throw',
    unknownArgBehaviour: 'throw',
    programDescription: '',
    programName: ''
  } as const

  it('can coerce a number argument', async () => {
    const flag = makeInternalFlag({
      isPrimary: true,
      long: 'number',
      inner: a.number()
    })

    const coerced = await parseAndCoerce('--number 1', opts, [flag])

    expect(coerced.command).toEqual({
      isDefault: true
    })
    expect(coerced.args.get(flag)).toEqual({
      isMulti: false,
      coerced: 1,
      raw: '1'
    })
  })

  it('can coerce an unquoted string argument', async () => {
    const flag = makeInternalFlag({
      isPrimary: true,
      long: 'string',
      inner: a.string()
    })

    const coerced = await parseAndCoerce('--string helloworld', opts, [flag])

    expect(coerced.command).toEqual({
      isDefault: true
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

    const coerced = await parseAndCoerce('--string "hello world"', opts, [flag])

    expect(coerced.command).toEqual({
      isDefault: true
    })
    expect(coerced.args.get(flag)).toEqual({
      isMulti: false,
      coerced: 'hello world',
      raw: 'hello world'
    })
  })
})