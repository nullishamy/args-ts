/* eslint-disable @typescript-eslint/quotes */
import { runArgsExecution } from './utils'
import { Args } from '../../src'
import { a } from '../../src/builder'
import { parserOpts } from '../shared'

describe('Flag integrations', () => {
  it('can parse a long-flag flag', async () => {
    const parser = new Args(parserOpts)
      .arg(['--boolean'], a.bool())

    const result = await runArgsExecution(parser, '--boolean')
    expect(result.boolean).toBe(true)
  })

  it('can parse decimals', async () => {
    const parser = new Args(parserOpts)
      .arg(['--decimal'], a.decimal())

    const result = await runArgsExecution(parser, '--decimal 1.234')
    expect(result.decimal).toBe(1.234)
  })

  it('can parse bigints', async () => {
    const parser = new Args(parserOpts)
      .arg(['--chonk'], a.bigint())

    const result = await runArgsExecution(parser, '--chonk 1234567891011121314')
    expect(result.chonk).toBe(1234567891011121314n)
  })

  it('can parse from an array', async () => {
    const parser = new Args(parserOpts)
      .arg(['--boolean'], a.bool())

    const result = await runArgsExecution(parser, ['--boolean', 'false'])
    expect(result.boolean).toBe(false)
  })

  it('can parse long-flag quoted strings', async () => {
    const parser = new Args(parserOpts)
      .arg(['--string', '-s'], a.string())

    const result = await runArgsExecution(parser, "--string 'string'")

    expect(result.string).toBe('string')
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

    const result = expect(async () => await runArgsExecution(parser, ''))
    await result.rejects.toMatchInlineSnapshot(`[Error: argument '--custom' is missing, with no unspecified default, expected 'custom' received '<nothing>' @ --custom]`)
  })
  it('throws if there is no tokens after the flag denotion', async () => {
    const parser = new Args(parserOpts)
      .arg(['--flag'], a.bool())

    const result = expect(async () => await runArgsExecution(parser, '--'))
    await result.rejects.toMatchInlineSnapshot(`[Error: expected: <more tokens> -- received: EOF @ 2 : --]`)
  })

  it('throws if there is a missing custom parser', async () => {
    const parser = new Args(parserOpts)
      .arg(['--custom', '-c'], a.custom<undefined>(undefined as any))

    const result = expect(async () => await runArgsExecution(parser, '-c this'))
    await result.rejects.toMatchInlineSnapshot(`[Error: could not parse a 'custom' because callback was not provided, expected 'custom' received 'this' @ --custom]`)
  })

  it('can parse long flags with dashes in them', async () => {
    const parser = new Args(parserOpts)
      .arg(['--dashing-arg'], a.string())

    const result = await runArgsExecution(parser, '--dashing-arg test')
    expect(result['dashing-arg']).toBe('test')
  })

  it('supports flag=value syntax for long flags', async () => {
    const parser = new Args(parserOpts)
      .arg(['--equality'], a.string())

    const result = await runArgsExecution(parser, '--equality=test')
    expect(result.equality).toBe('test')
  })

  it('supports flag=value syntax for short flags', async () => {
    const parser = new Args(parserOpts)
      .arg(['--equality', '-e'], a.string())

    const result = await runArgsExecution(parser, '-e=test')
    expect(result.equality).toBe('test')
  })

  it('fails if flag=value syntax is disabled for long flags', async () => {
    const parser = new Args({
      ...parserOpts,
      keyEqualsValueSyntax: false
    })
      .arg(['--equality'], a.string())

    const result = expect(async () => await runArgsExecution(parser, '--equality=test'))
    await result.rejects.toMatchInlineSnapshot(`[Error: encountered k=v syntax when parsing '--equality', but k=v syntax is disabled @ 15 : --equality=test]`)
  })

  it('fails if flag=value syntax is disabled for short flags', async () => {
    const parser = new Args({
      ...parserOpts,
      keyEqualsValueSyntax: false
    })
      .arg(['--equality', '-e'], a.string())

    const result = expect(async () => await runArgsExecution(parser, '-e=test'))
    await result.rejects.toMatchInlineSnapshot(`[Error: encountered k=v syntax when parsing '-e', but k=v syntax is disabled @ 7 : -e=test]`)
  })
})

describe('Positional integrations', () => {
  it('can collate positionals', async () => {
    const parser = new Args(parserOpts)
      .positional('<boolean>', a.bool().array())

    const result = await runArgsExecution(parser, 'true true false true')
    expect(result.boolean).toEqual([true, true, false, true])
  })

  it('can parse single positionals', async () => {
    const parser = new Args(parserOpts)
      .positional('<boolean>', a.bool())

    const result = await runArgsExecution(parser, 'true')
    expect(result.boolean).toBe(true)
  })

  it('fails if a positional is missing', async () => {
    const parser = new Args(parserOpts)
      .positional('<str>', a.string())

    const result = expect(async () => await runArgsExecution(parser, ''))
    await result.rejects.toMatchInlineSnapshot(`[Error: positional argument 'str' is not declared as optional, does not have a default, and was not provided a value, expected 'string' received '<nothing>' @ str]`)
  })
})

describe('Other integrations (no commands)', () => {
  it('falls back to present default when not given a value', async () => {
    const parser = new Args(parserOpts)
      .arg(['--string', '-s'], a.string().presentDefault('present'))

    const result = await runArgsExecution(parser, '-s')
    expect(result.string).toBe('present')
  })

  it('can utilise 2 parsers with long flags', async () => {
    const parser = new Args(parserOpts)
      .arg(['--union'], a.number().or(a.bool()))

    const result = await runArgsExecution(parser, '--union true')
    expect(result.union).toBe(true)
  })

  it('can utilise 2 parsers with short flags', async () => {
    const parser = new Args(parserOpts)
      .arg(['--union', '-u'], a.number().or(a.bool()))

    const result = await runArgsExecution(parser, '-u true')
    expect(result.union).toBe(true)
  })

  it('can utilise 3 parsers with short flags', async () => {
    const parser = new Args(parserOpts)
      .arg(['--union', '-u'], a.number().or(a.bool()).or(a.string()))

    const result = await runArgsExecution(parser, '-u true')
    expect(result.union).toBe(true)
  })
  it('can utilise 3 parsers with long flags', async () => {
    const parser = new Args(parserOpts)
      .arg(['--union', '-u'], a.number().or(a.bool()).or(a.string()))

    const result = await runArgsExecution(parser, '--union true')
    expect(result.union).toBe(true)
  })
  it('can select a non edge parser with short flags', async () => {
    const parser = new Args(parserOpts)
      .arg(['--union', '-u'], a.bool().or(a.number()).or(a.string()))

    const result = await runArgsExecution(parser, '-u 12')
    expect(result.union).toBe(12)
  })
  it('can select a non edge parser with long flags', async () => {
    const parser = new Args(parserOpts)
      .arg(['--union', '-u'], a.bool().or(a.number()).or(a.string()))

    const result = await runArgsExecution(parser, '--union 12')
    expect(result.union).toBe(12)
  })

  it('rejects with all coerecion errors', async () => {
    const parser = new Args(parserOpts)
      .arg(['--bool'], a.bool().array())

    await expect(async () => await runArgsExecution(parser, '--bool fff xyz')).rejects.toMatchInlineSnapshot(`
[Error: could not parse a 'boolean' because 'fff' is not a boolean, expected 'boolean' received 'fff' @ --bool
could not parse a 'boolean' because 'xyz' is not a boolean, expected 'boolean' received 'xyz' @ --bool]
`)
  })

  it('rejects when excess values are passed to an argument', async () => {
    const parser = new Args(parserOpts)
      .arg(['--string', '-s'], a.string())

    const result = expect(async () => await runArgsExecution(parser, '-s one two'))
    await result.rejects.toMatchInlineSnapshot(`[Error: excess argument(s) to --string: 'two', expected 'string' received 'one two' @ --string]`)
  })

  it('skips when excess values are passed to an argument', async () => {
    const parser = new Args({
      ...parserOpts,
      tooManyArgs: 'drop'
    })
      .arg(['--string', '-s'], a.string())

    const result = await runArgsExecution(parser, '-s one two')
    expect(result.string).toBe('one')
  })

  it('rejects for incomplete strings', async () => {
    const parser = new Args(parserOpts)
      .arg(['--string', '-s'], a.string())

    const result = expect(async () => await runArgsExecution(parser, '-s "'))
    await result.rejects.toMatchInlineSnapshot(`[Error: argument 'string' is not declared as optional, does not have a default, and was not provided a value, expected 'string' received '<nothing>' @ --string]`)
  })

  it('throws if there is additional arguments', async () => {
    const parser = new Args(parserOpts)

    const result = expect(async () => await runArgsExecution(parser, '-c this'))
    await result.rejects.toMatchInlineSnapshot(`[Error: unrecognised argument '-c this', expected '<nothing>' received '-c this' @ -c this]`)
  })

  it('skips if there is unrecognised arguments', async () => {
    const parser = new Args({
      ...parserOpts,
      unrecognisedArgument: 'skip'
    })

    const result = await runArgsExecution(parser, '-c this')
    expect(result).toEqual({})
  })

  it('rejects if the environment fallback cannot be parsed', async () => {
    process.env.APP_ENV = 'test'

    const parser = new Args({
      ...parserOpts,
      environmentPrefix: 'APP'
    })
      .arg(['--env'], a.bool())

    const result = expect(async () => await runArgsExecution(parser, ''))
    await result.rejects.toMatchInlineSnapshot(`[Error: could not parse a 'boolean' because 'test' is not a boolean, expected 'boolean' received 'test' @ --env]`)
  })

  it('can fallback to the environment for a flag', async () => {
    process.env.APP_ENV = 'test'

    const parser = new Args({
      ...parserOpts,
      environmentPrefix: 'APP'
    })
      .arg(['--env'], a.string())

    const result = await runArgsExecution(parser, '')
    expect(result.env).toBe('test')
  })

  it('can fallback to the environment for a positional', async () => {
    process.env.APP_ENV = 'test'

    const parser = new Args({
      ...parserOpts,
      environmentPrefix: 'APP'
    })
      .positional('<env>', a.string())

    const result = await runArgsExecution(parser, '')
    expect(result.env).toBe('test')
  })

  it('passes if the arg is optional, and no env value is present', async () => {
    const parser = new Args({
      ...parserOpts,
      environmentPrefix: 'APP'
    })
      .arg(['--pass'], a.string().optional())

    const result = await runArgsExecution(parser, '')
    expect(result.pass).toBe(undefined)
  })

  it('fails if an env prefix is set but no value is in the env', async () => {
    const parser = new Args({
      ...parserOpts,
      environmentPrefix: 'APP'
    })
      .arg(['--missing'], a.string())

    const result = expect(async () => await runArgsExecution(parser, ''))
    await result.rejects.toMatchInlineSnapshot(`[Error: argument '--missing' is missing, with no unspecified default, expected 'string' received '<nothing>' @ --missing]`)
  })

  it('fails if an unknown flag in a group is found', async () => {
    const parser = new Args(parserOpts)
      .arg(['--a-bool', '-a'], a.bool())
      .arg(['--b-bool', '-b'], a.bool())

    const result = expect(async () => await runArgsExecution(parser, '-abc'))
    await result.rejects.toMatchInlineSnapshot(`[Error: unrecognised flag 'c' in group 'abc', expected '<nothing>' received '-abc' @ c]`)
  })

  it('can parse short flag groups', async () => {
    const parser = new Args(parserOpts)
      .arg(['--a-bool', '-a'], a.bool())
      .arg(['--b-bool', '-b'], a.bool())
      .arg(['--c-bool', '-c'], a.bool())

    const result = await runArgsExecution(parser, '-abc')
    expect(result['a-bool']).toBe(true)
    expect(result['b-bool']).toBe(true)
    expect(result['c-bool']).toBe(true)
  })
})

it('fails if short flag grouping is not enabled', async () => {
  const parser = new Args({
    ...parserOpts,
    shortFlagGroups: false
  })
    .arg(['--a-bool', '-a'], a.bool())
    .arg(['--b-bool', '-b'], a.bool())
    .arg(['--c-bool', '-c'], a.bool())

  const result = expect(async () => await runArgsExecution(parser, '-abc'))
  await result.rejects.toMatchInlineSnapshot(`[Error: encountered short flag group '-abc', but short flag grouping is disabled. @ 4 : -abc]`)
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

  it('drops multiple definitions', async () => {
    const parser = new Args({
      ...parserOpts,
      tooManyDefinitions: 'drop'
    })
      .arg(['--array'], a.string())

    const result = await runArgsExecution(parser, '--array value1 --array value2')
    expect(result.array).toStrictEqual('value1')
  })

  it('overwrites multiple definitions', async () => {
    const parser = new Args({
      ...parserOpts,
      tooManyDefinitions: 'overwrite'
    })
      .arg(['--array'], a.string())

    const result = await runArgsExecution(parser, '--array value1 --array value2')
    expect(result.array).toStrictEqual('value2')
  })

  it('throws when multiple definitions', async () => {
    const parser = new Args({
      ...parserOpts,
      tooManyDefinitions: 'throw'
    })
      .arg(['--array'], a.string())

    const result = expect(async () => await runArgsExecution(parser, '--array value1 --array value2'))
    await result.rejects.toMatchInlineSnapshot(`[Error: argument --array' is not permitted to have multiple definitions, expected 'single definition' received 'multiple definitions' @ --array]`)
  })
  it('fails when dependencies are not met', async () => {
    const parser = new Args(parserOpts)
      .arg(['--dependency'], a.bool())
      .arg(['--dependant'], a.bool().dependsOn('--dependency'))

    const result = expect(async () => await runArgsExecution(parser, '--dependant'))
    await result.rejects.toMatchInlineSnapshot(`[Error: unmet dependency '--dependency' for '--dependant', expected 'a value' received '<nothing>' @ --dependant]`)
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

    const result = expect(async () => await runArgsExecution(parser, '--conflict --base'))
    await result.rejects.toMatchInlineSnapshot(`[Error: argument '--conflict' conflicts with '--base', expected '--conflict to not be passed' received '--conflict' @ --base]`)
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

    const result = expect(async () => await runArgsExecution(parser, '--conflict --exclusive'))
    await result.rejects.toMatchInlineSnapshot(`[Error: argument '--exclusive' is exclusive and cannot be used with other arguments, expected 'no other args to be passed' received '1 other arguments' @ --exclusive]`)
  })

  it('fails when strings are too short', async () => {
    const parser = new Args(parserOpts)
      .arg(['--string'], a.string().min(5))

    const result = expect(async () => await runArgsExecution(parser, '--string 1'))
    await result.rejects.toMatchInlineSnapshot(`[Error: could not parse a 'string' because value must be at least length 5, got '1', expected 'string' received '1' @ --string]`)
  })

  it('fails when strings are blank', async () => {
    const parser = new Args(parserOpts)
      .arg(['--string'], a.string().notBlank())

    const result = expect(async () => await runArgsExecution(parser, '--string " "'))
    await result.rejects.toMatchInlineSnapshot(`[Error: could not parse a 'non-blank string' because ' ' does not match '/(.|\\s)*\\S(.|\\s)*/', expected 'non-blank string' received ' ' @ --string]`)
  })

  it('fails when strings are too long', async () => {
    const parser = new Args(parserOpts)
      .arg(['--string'], a.string().max(5))

    const result = expect(async () => await runArgsExecution(parser, '--string 123456'))
    await result.rejects.toMatchInlineSnapshot(`[Error: could not parse a 'string' because value must be at most length 5, got '123456', expected 'string' received '123456' @ --string]`)
  })

  it('fails when numbers are below lower bounds', async () => {
    const parser = new Args(parserOpts)
      .arg(['--number'], a.number().lowerBound(5))

    const result = expect(async () => await runArgsExecution(parser, '--number 1'))
    await result.rejects.toMatchInlineSnapshot(`[Error: could not parse a 'number' because 1 is less than lower bound 5, expected 'number' received '1' @ --number]`)
  })

  it('fails when numbers are above upper bounds', async () => {
    const parser = new Args(parserOpts)
      .arg(['--number'], a.number().upperBound(5))

    const result = expect(async () => await runArgsExecution(parser, '--number 10'))
    await result.rejects.toMatchInlineSnapshot(`[Error: could not parse a 'number' because 10 is greater than upper bound 5, expected 'number' received '10' @ --number]`)
  })

  it('fails when numbers are not in range', async () => {
    const parser = new Args(parserOpts)
      .arg(['--number'], a.number().inRange(10, 20))

    const result = expect(async () => await runArgsExecution(parser, '--number 3'))
    await result.rejects.toMatchInlineSnapshot(`[Error: could not parse a 'number' because 3 is less than lower bound 10, expected 'number' received '3' @ --number]`)
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

    const result = expect(async () => await runArgsExecution(parser, ''))
    await result.rejects.toMatchInlineSnapshot(`[Error: argument '--optional' is missing, with no unspecified default, expected 'string' received '<nothing>' @ --optional]`)
  })

  it('fails when an invalid enum value is provided', async () => {
    const parser = new Args(parserOpts)
      .arg(['--enum'], a.oneOf(['x', 'y', 'z'] as const))

    const result = expect(async () => await runArgsExecution(parser, '--enum a'))
    await result.rejects.toMatchInlineSnapshot(`[Error: could not parse a 'x | y | z' because value must be one of 'x, y, z' got 'a', expected 'x | y | z' received 'a' @ --enum]`)
  })

  it('passes when a valid enum value is provided', async () => {
    const parser = new Args(parserOpts)
      .arg(['--enum'], a.oneOf(['x', 'y', 'z'] as const))

    const result = await runArgsExecution(parser, '--enum x')
    expect(result.enum).toEqual('x')
  })

  it('negates booleans based on prefix', async () => {
    const parser = new Args(parserOpts)
      .arg(['--bool'], a.bool())

    const result = await runArgsExecution(parser, '--no-bool')
    expect(result.bool).toEqual(false)
  })

  it('negates booleans based on configured prefix', async () => {
    const parser = new Args({
      ...parserOpts,
      negatedBooleanPrefix: 'nope-'
    })
      .arg(['--bool'], a.bool())

    const result = await runArgsExecution(parser, '--nope-bool')
    expect(result.bool).toEqual(false)
  })

  it('disables boolean negation if the prefix is empty', async () => {
    const parser = new Args({
      ...parserOpts,
      negatedBooleanPrefix: ''
    })
      .arg(['--bool'], a.bool())

    const result = expect(async () => await runArgsExecution(parser, '--no-bool'))
    await result.rejects.toMatchInlineSnapshot(`[Error: unrecognised argument '--no-bool', expected '<nothing>' received '--no-bool' @ --no-bool]`)
  })
})

describe('Array testing', () => {
  it('parses arrays with one element', async () => {
    const parser = new Args(parserOpts)
      .arg(['--array'], a.number().array())

    const result = await runArgsExecution(parser, '--array 123')
    expect(result.array).toEqual([123])
  })

  it('appends to arrays with multiple definitions', async () => {
    const parser = new Args(parserOpts)
      .arg(['--array'], a.string().array())

    const result = await runArgsExecution(parser, '--array value1 --array value2')
    expect(result.array).toStrictEqual(['value1', 'value2'])
  })

  it('drops to arrays with multiple definitions', async () => {
    const parser = new Args({
      ...parserOpts,
      arrayMultipleDefinitions: 'drop'
    })
      .arg(['--array'], a.string().array())

    const result = await runArgsExecution(parser, '--array value1 --array value2')
    expect(result.array).toStrictEqual(['value1'])
  })

  it('overwrites to arrays with multiple definitions', async () => {
    const parser = new Args({
      ...parserOpts,
      arrayMultipleDefinitions: 'overwrite'
    })
      .arg(['--array'], a.string().array())

    const result = await runArgsExecution(parser, '--array value1 --array value2')
    expect(result.array).toStrictEqual(['value2'])
  })

  it('throws when multiple array definitions', async () => {
    const parser = new Args({
      ...parserOpts,
      arrayMultipleDefinitions: 'throw'
    })
      .arg(['--array'], a.string().array())

    const result = expect(async () => await runArgsExecution(parser, '--array value1 --array value2'))
    await result.rejects.toMatchInlineSnapshot(`[Error: argument --array' is not permitted to have multiple definitions, expected 'single definition' received 'multiple definitions' @ --array]`)
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

    const result = expect(async () => await runArgsExecution(parser, '--array 123 783 true 1235'))
    await result.rejects.toMatchInlineSnapshot(`[Error: could not parse a 'number' because 'true' is not a number, expected 'number' received 'true' @ --array]`)
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

    const result = expect(async () => await runArgsExecution(parser, '--array 123 783 1235'))
    await result.rejects.toMatchInlineSnapshot(`[Error: could not parse a 'number' because 1235 is greater than upper bound 1000, expected 'number' received '1235' @ --array]`)
  })

  it('can coerce "T[] | U[]" style unions using left side parser', async () => {
    const parser = new Args(parserOpts)
      .arg(['--array'], a.number().array().or(a.bool().array()))

    const result = await runArgsExecution(parser, '--array 12 78 98 66')
    expect(result.array).toEqual([
      12,
      78,
      98,
      66
    ])
  })

  it('can coerce "T[] | U[]" style unions using right side parser', async () => {
    const parser = new Args(parserOpts)
      .arg(['--array'], a.number().array().or(a.bool().array()))

    const result = await runArgsExecution(parser, '--array true true false false true')
    expect(result.array).toEqual([
      true,
      true,
      false,
      false,
      true
    ])
  })
})
