/* eslint-disable @typescript-eslint/quotes */
import { parserOpts } from '.'
import { Args } from '../src'
import { a } from '../src/builder'

describe('Primitive parsing', () => {
  it('can parse a long-flag flag', async () => {
    const parser = new Args(parserOpts)
      .add(['--boolean'], a.Boolean())

    const result = await parser.parse('--boolean')

    expect(result.boolean).toBe(true)
  })

  it('can parse a short-flag flag', async () => {
    const parser = new Args(parserOpts)
      .add(['--boolean', '-b'], a.Boolean())

    const result = await parser.parse('-b')

    expect(result.boolean).toBe(true)
  })

  it('can parse short-flag numbers', async () => {
    const parser = new Args(parserOpts)
      .add(['--number', '-n'], a.Number())

    const result = await parser.parse('-n 12')

    expect(result.number).toBe(12)
  })

  it('can parse long-flag numbers', async () => {
    const parser = new Args(parserOpts)
      .add(['--number'], a.Number())

    const result = await parser.parse('--number 12')

    expect(result.number).toBe(12)
  })

  it('can parse long-flag strings', async () => {
    const parser = new Args(parserOpts)
      .add(['--string'], a.String())

    const result = await parser.parse('--string string')

    expect(result.string).toBe('string')
  })

  it('can parse short-flag strings', async () => {
    const parser = new Args(parserOpts)
      .add(['--string', '-s'], a.String())

    const result = await parser.parse('-s string')

    expect(result.string).toBe('string')
  })

  it('can parse short-flag quoted strings', async () => {
    const parser = new Args(parserOpts)
      .add(['--string', '-s'], a.String())

    const result = await parser.parse("-s 'string'")

    expect(result.string).toBe('string')
  })

  it('can parse long-flag quoted strings', async () => {
    const parser = new Args(parserOpts)
      .add(['--string', '-s'], a.String())

    const result = await parser.parse("--string 'string'")

    expect(result.string).toBe('string')
  })

  const customCallback = (value: string) => ({
    ok: true,
    passedValue: value,
    returnedValue: 'custom value'
  } as const)

  it('can parse short-flag custom values', async () => {
    const parser = new Args(parserOpts)
      .add(['--custom', '-c'], a.Custom(customCallback))

    const result = await parser.parse('-c test')

    expect(result.custom).toBe('custom value')
  })

  it('can parse long-flag custom values', async () => {
    const parser = new Args(parserOpts)
      .add(['--custom'], a.Custom(customCallback))

    const result = await parser.parse('--custom test')

    expect(result.custom).toBe('custom value')
  })

  it('throws if there is a missing arg', async () => {
    const parser = new Args(parserOpts)
      .add(['--custom', '-c'], a.Custom(customCallback))

    await expect(async () => await parser.parse('')).rejects.toMatchInlineSnapshot(`[Error: argument '--custom' is missing]`)
  })

  it('throws if there is a missing custom parser', async () => {
    const parser = new Args(parserOpts)
      .add(['--custom', '-c'], a.Custom(undefined as any))

    await expect(async () => await parser.parse('-c this')).rejects.toMatchInlineSnapshot(`
[Error: encountered 1 error(s) whilst parsing:

error "callback was not provided" whilst parsing "--custom this" (argument number 1)]
`)
  })

  it('throws if there is additional arguments', async () => {
    const parser = new Args(parserOpts)
    await expect(async () => await parser.parse('-c this')).rejects.toMatchInlineSnapshot(`[Error: unexpected argument '--c']`)
  })

  it('skips if there is additional arguments', async () => {
    const parser = new Args({
      ...parserOpts,
      unknownArgBehaviour: 'skip'
    })

    const result = await parser.parse('-c this')
    expect(result).toMatchInlineSnapshot(`{}`)
  })
})
