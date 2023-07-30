/* eslint-disable @typescript-eslint/quotes */
import { parserOpts, runArgsExecution } from '.'
import { Args } from '../src'
import { a } from '../src/builder'

describe('Primitive parsing', () => {
  it('can parse a long-flag flag', async () => {
    const parser = new Args(parserOpts)
      .add(['--boolean'], a.bool().optional().required())

    const result = await runArgsExecution(parser, '--boolean')
    expect(result.boolean).toBe(true)
  })

  it('can parse a short-flag flag', async () => {
    const parser = new Args(parserOpts)
      .add(['--boolean', '-b'], a.bool())

    const result = await runArgsExecution(parser, '-b')

    expect(result.boolean).toBe(true)
  })

  it('can parse short-flag numbers', async () => {
    const parser = new Args(parserOpts)
      .add(['--number', '-n'], a.number())

    const result = await runArgsExecution(parser, '-n 12')

    expect(result.number).toBe(12)
  })

  it('can parse long-flag numbers', async () => {
    const parser = new Args(parserOpts)
      .add(['--number'], a.number())

    const result = await runArgsExecution(parser, '--number 12')

    expect(result.number).toBe(12)
  })

  it('can parse long-flag strings', async () => {
    const parser = new Args(parserOpts)
      .add(['--string'], a.string())

    const result = await runArgsExecution(parser, '--string string')

    expect(result.string).toBe('string')
  })

  it('can parse short-flag strings', async () => {
    const parser = new Args(parserOpts)
      .add(['--string', '-s'], a.string())

    const result = await runArgsExecution(parser, '-s string')

    expect(result.string).toBe('string')
  })

  it('can parse short-flag quoted strings', async () => {
    const parser = new Args(parserOpts)
      .add(['--string', '-s'], a.string())

    const result = await runArgsExecution(parser, "-s 'string'")

    expect(result.string).toBe('string')
  })

  it('can parse long-flag quoted strings', async () => {
    const parser = new Args(parserOpts)
      .add(['--string', '-s'], a.string())

    const result = await runArgsExecution(parser, "--string 'string'")

    expect(result.string).toBe('string')
  })

  const customCallback = (value: string) => ({
    ok: true,
    passedValue: value,
    returnedValue: 'custom value'
  } as const)

  it('can parse short-flag custom values', async () => {
    const parser = new Args(parserOpts)
      .add(['--custom', '-c'], a.custom(customCallback))

    const result = await runArgsExecution(parser, '-c test')

    expect(result.custom).toBe('custom value')
  })

  it('can parse long-flag custom values', async () => {
    const parser = new Args(parserOpts)
      .add(['--custom'], a.custom(customCallback))

    const result = await runArgsExecution(parser, '--custom test')

    expect(result.custom).toBe('custom value')
  })

  it('throws if there is a missing arg', async () => {
    const parser = new Args(parserOpts)
      .add(['--custom', '-c'], a.custom(customCallback))

    await expect(async () => await runArgsExecution(parser, '')).rejects.toMatchInlineSnapshot(`[Error: Err(ParseError { argument '--custom' is missing })]`)
  })

  it('throws if there is a missing custom parser', async () => {
    const parser = new Args(parserOpts)
      .add(['--custom', '-c'], a.custom(undefined as any))

    await expect(async () => await runArgsExecution(parser, '-c this')).rejects.toMatchInlineSnapshot(`[Error: Err(CoercionError { encountered error: \`callback was not provided\` when coercing "--custom this" })]`)
  })

  it('throws if there is additional arguments', async () => {
    const parser = new Args(parserOpts)
    await expect(async () => await runArgsExecution(parser, '-c this')).rejects.toMatchInlineSnapshot(`[Error: Err(CoercionError { unexpected argument '--c' })]`)
  })

  it('skips if there is additional arguments', async () => {
    const parser = new Args({
      ...parserOpts,
      unknownArgBehaviour: 'skip'
    })

    const result = await runArgsExecution(parser, '-c this')
    expect(result).toMatchInlineSnapshot(`{}`)
  })
})
