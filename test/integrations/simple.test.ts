/* eslint-disable @typescript-eslint/quotes */
import { runArgsExecution } from './utils'
import { Args } from '../../src'
import { a } from '../../src/builder'
import { parserOpts } from '../shared'

describe('Simple integrations (no commands)', () => {
  it('can parse a long-flag flag', async () => {
    const parser = new Args(parserOpts)
      .arg(['--boolean'], a.bool())

    const result = await runArgsExecution(parser, '--boolean')
    expect(result.boolean).toBe(true)
  })

  it('can correcty assign defaults for unspecified flags', async () => {
    const parser = new Args(parserOpts)
      .arg(['--boolean'], a.bool())

    const result = await runArgsExecution(parser, '')
    expect(result.boolean).toBe(false)
  })

  it('can correcty assign defaults for unspecified flags with overrides', async () => {
    const parser = new Args(parserOpts)
      .arg(['--boolean'], a.bool().default(true))

    const result = await runArgsExecution(parser, '')
    expect(result.boolean).toBe(true)
  })

  it('can parse a short-flag flag', async () => {
    const parser = new Args(parserOpts)
      .arg(['--boolean', '-b'], a.bool())

    const result = await runArgsExecution(parser, '-b')

    expect(result.boolean).toBe(true)
  })

  it('can parse short-flag numbers', async () => {
    const parser = new Args(parserOpts)
      .arg(['--number', '-n'], a.number())

    const result = await runArgsExecution(parser, '-n 12')

    expect(result.number).toBe(12)
  })

  it('can parse long-flag numbers', async () => {
    const parser = new Args(parserOpts)
      .arg(['--number'], a.number())

    const result = await runArgsExecution(parser, '--number 12')

    expect(result.number).toBe(12)
  })

  it('can parse long-flag strings', async () => {
    const parser = new Args(parserOpts)
      .arg(['--string'], a.string())

    const result = await runArgsExecution(parser, '--string string')

    expect(result.string).toBe('string')
  })

  it('can parse short-flag strings', async () => {
    const parser = new Args(parserOpts)
      .arg(['--string', '-s'], a.string())

    const result = await runArgsExecution(parser, '-s string')

    expect(result.string).toBe('string')
  })

  it('can parse short-flag quoted strings', async () => {
    const parser = new Args(parserOpts)
      .arg(['--string', '-s'], a.string())

    const result = await runArgsExecution(parser, "-s 'string'")

    expect(result.string).toBe('string')
  })

  it('can parse long-flag quoted strings', async () => {
    const parser = new Args(parserOpts)
      .arg(['--string', '-s'], a.string())

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
      .arg(['--custom', '-c'], a.custom(customCallback))

    const result = await runArgsExecution(parser, '-c test')

    expect(result.custom).toBe('custom value')
  })

  it('can parse long-flag custom values', async () => {
    const parser = new Args(parserOpts)
      .arg(['--custom'], a.custom(customCallback))

    const result = await runArgsExecution(parser, '--custom test')

    expect(result.custom).toBe('custom value')
  })

  it('throws if there is a missing arg', async () => {
    const parser = new Args(parserOpts)
      .arg(['--custom', '-c'], a.custom(customCallback))

    await expect(async () => await runArgsExecution(parser, '')).rejects.toMatchInlineSnapshot(`[Error: argument '--custom' is missing, expected 'custom' received '<nothing>']`)
  })

  it('throws if there is a missing custom parser', async () => {
    const parser = new Args(parserOpts)
      .arg(['--custom', '-c'], a.custom<undefined>(undefined as any))

    await expect(async () => await runArgsExecution(parser, '-c this')).rejects.toMatchInlineSnapshot(`[Error: callback was not provided, expected 'custom' received 'this']`)
  })

  it('throws if there is additional arguments', async () => {
    const parser = new Args(parserOpts)
    await expect(async () => await runArgsExecution(parser, '-c this')).rejects.toMatchInlineSnapshot(`[Error: unexpected argument '-c this', expected '<nothing>' received '-c this']`)
  })

  it('throws if there is excess arguments', async () => {
    const parser = new Args(parserOpts)
      .arg(['--excess'], a.string())
    await expect(async () => await runArgsExecution(parser, '--excess this this2')).rejects.toMatchInlineSnapshot(`[Error: excess argument(s) to --excess: 'this2', expected 'string' received 'this this2']`)
  })

  it('skips if there is additional arguments', async () => {
    const parser = new Args({
      ...parserOpts,
      unknownArgBehaviour: 'skip'
    })

    const result = await runArgsExecution(parser, '-c this')
    expect(result).toMatchInlineSnapshot('{}')
  })

  it('can parse long flags with dashes in them', async () => {
    const parser = new Args(parserOpts)
      .arg(['--dashing-arg'], a.string())

    const result = await runArgsExecution(parser, '--dashing-arg test')
    expect(result['dashing-arg']).toBe('test')
  })

  it('supports flag=value syntax', async () => {
    const parser = new Args(parserOpts)
      .arg(['--equality'], a.string())

    const result = await runArgsExecution(parser, '--equality=test')
    expect(result.equality).toBe('test')
  })
})

describe('Logical argument testing', () => {
  it('passes when all dependencies are satisfied', async () => {
    const parser = new Args(parserOpts)
      .arg(['--dependency'], a.bool())
      .arg(['--dependant'], a.bool().dependsOn('--dependency'))

    const result = await runArgsExecution(parser, '--dependency --dependant')
    expect(result.dependency).toBe(true)
    expect(result.dependant).toBe(true)
  })

  it('fails when dependencies are not met', async () => {
    const parser = new Args(parserOpts)
      .arg(['--dependency'], a.bool())
      .arg(['--dependant'], a.bool().dependsOn('--dependency'))

    await expect(async () => await runArgsExecution(parser, '--dependant')).rejects.toMatchInlineSnapshot(`[Error: unmet dependency '--dependency' for '--dependant', expected 'a value' received '<nothing>']`)
  })

  it('passes when conflicts do not arise', async () => {
    const parser = new Args(parserOpts)
      .arg(['--base'], a.bool().conflictsWith('--conflict'))
      .arg(['--conflict'], a.bool())

    const result = await runArgsExecution(parser, '--conflict')
    expect(result.conflict).toBe(true)
  })

  it('passes when conflicts do not arise (inverted)', async () => {
    const parser = new Args(parserOpts)
      .arg(['--base'], a.bool().conflictsWith('--conflict'))
      .arg(['--conflict'], a.bool())

    const result = await runArgsExecution(parser, '--base')
    expect(result.base).toBe(true)
  })

  it('fails when conflicts arise', async () => {
    const parser = new Args(parserOpts)
      .arg(['--base'], a.bool().conflictsWith('--conflict'))
      .arg(['--conflict'], a.bool())

    await expect(async () => await runArgsExecution(parser, '--conflict --base')).rejects.toMatchInlineSnapshot(`[Error: argument '--conflict' conflicts with '--base', expected '--conflict to not be passed' received '--conflict']`)
  })

  it('passes when no args are passed with the exclusive', async () => {
    const parser = new Args(parserOpts)
      .arg(['--exclusive'], a.bool().exclusive())

    const result = await runArgsExecution(parser, '--exclusive')
    expect(result.exclusive).toBe(true)
  })

  it('fails args are passed with the exclusive', async () => {
    const parser = new Args(parserOpts)
      .arg(['--exclusive'], a.bool().exclusive())
      .arg(['--conflict'], a.bool())

    await expect(async () => await runArgsExecution(parser, '--conflict --exclusive')).rejects.toMatchInlineSnapshot(`[Error: argument '--exclusive' is exclusive and cannot be used with other arguments, expected 'no other args to be passed' received '1 other arguments']`)
  })

  it('fails when strings are too short', async () => {
    const parser = new Args(parserOpts)
      .arg(['--string'], a.string().min(5))

    await expect(async () => await runArgsExecution(parser, '--string 1')).rejects.toMatchInlineSnapshot(`[Error: value must be at least length 5, got '1', expected 'string' received '1']`)
  })

  it('fails when strings are too long', async () => {
    const parser = new Args(parserOpts)
      .arg(['--string'], a.string().max(5))

    await expect(async () => await runArgsExecution(parser, '--string 123456')).rejects.toMatchInlineSnapshot(`[Error: value must be at most length 5, got '123456', expected 'string' received '123456']`)
  })

  it('fails when numbers are below lower bounds', async () => {
    const parser = new Args(parserOpts)
      .arg(['--number'], a.number().lowerBound(5))

    await expect(async () => await runArgsExecution(parser, '--number 1')).rejects.toMatchInlineSnapshot(`[Error: 1 is less than lower bound 5, expected 'number' received '1']`)
  })

  it('fails when numbers are above upper bounds', async () => {
    const parser = new Args(parserOpts)
      .arg(['--number'], a.number().upperBound(5))

    await expect(async () => await runArgsExecution(parser, '--number 10')).rejects.toMatchInlineSnapshot(`[Error: 10 is greater than upper bound 5, expected 'number' received '10']`)
  })

  it('fails when numbers are not in range', async () => {
    const parser = new Args(parserOpts)
      .arg(['--number'], a.number().inRange(10, 20))

    await expect(async () => await runArgsExecution(parser, '--number 3')).rejects.toMatchInlineSnapshot(`[Error: 3 is less than lower bound 10, expected 'number' received '3']`)
  })

  it('allows empty values when marked argument is provided', async () => {
    const parser = new Args(parserOpts)
      .arg(['--base'], a.string().optional())
      .arg(['--optional'], a.string().requireUnlessPresent('--base'))

    const result = await runArgsExecution(parser, '--base hello')
    expect(result.base).toEqual('hello')
  })

  it('fails when marked argument is not provided', async () => {
    const parser = new Args(parserOpts)
      .arg(['--base'], a.string().optional())
      .arg(['--optional'], a.string().requireUnlessPresent('--base'))

    await expect(async () => await runArgsExecution(parser, '')).rejects.toMatchInlineSnapshot(`[Error: argument '--optional' is missing, expected 'string' received '<nothing>']`)
  })

  it('fails when an invalid enum value is provided', async () => {
    const parser = new Args(parserOpts)
      .arg(['--enum'], a.oneOf(['x', 'y', 'z'] as const))

    await expect(async () => await runArgsExecution(parser, '--enum a')).rejects.toMatchInlineSnapshot(`[Error: value must be one of 'x, y, z' got 'a', expected 'enum' received 'a']`)
  })

  it('passes when a valid enum value is provided', async () => {
    const parser = new Args(parserOpts)
      .arg(['--enum'], a.oneOf(['x', 'y', 'z'] as const))

    const result = await runArgsExecution(parser, '--enum x')
    expect(result.enum).toEqual('x')
  })
})

describe('Array testing', () => {
  it('parses arrays with one element', async () => {
    const parser = new Args(parserOpts)
      .arg(['--array'], a.number().array())

    const result = await runArgsExecution(parser, '--array 123')
    expect(result.array).toEqual([123])
  })

  it('parses arrays with many elements', async () => {
    const parser = new Args(parserOpts)
      .arg(['--array'], a.number().array())

    const result = await runArgsExecution(parser, '--array 123 783 389 1235')
    expect(result.array).toEqual([
      123,
      783,
      389,
      1235
    ])
  })

  it('fails when an array element has the wrong type', async () => {
    const parser = new Args(parserOpts)
      .arg(['--array'], a.number().array())

    await expect(async () => await runArgsExecution(parser, '--array 123 783 true 1235')).rejects.toMatchInlineSnapshot(`[Error: 'true' is not a number, expected 'number' received 'true']`)
  })

  it('parses arrays with of bool', async () => {
    const parser = new Args(parserOpts)
      .arg(['--array'], a.bool().array())

    const result = await runArgsExecution(parser, '--array true true false false true')
    expect(result.array).toEqual([
      true,
      true,
      false,
      false,
      true
    ])
  })

  it('fails when an array element is above upper bound', async () => {
    const parser = new Args(parserOpts)
      .arg(['--array'], a.number().inRange(100, 1000).array())

    await expect(async () => await runArgsExecution(parser, '--array 123 783 1235')).rejects.toMatchInlineSnapshot(`[Error: 1235 is greater than upper bound 1000, expected 'number' received '1235']`)
  })
})
