/* eslint-disable @typescript-eslint/quotes */
import { parserOpts } from '.'
import { Args } from '../src'
import { a, Argument, ParseResult } from '../src/builder'

class CustomParseClass extends Argument<{ theValue: string }> {
  constructor () {
    super('custom')
  }

  public async parse (value: string): Promise<ParseResult<{ theValue: string }>> {
    return {
      ok: true,
      passedValue: value,
      returnedValue: {
        theValue: value
      }
    }
  }
}

describe('Complex parsing', () => {
  it('can utilise custom classes in arguments', async () => {
    const parser = new Args(parserOpts)
      .add(['--class'], new CustomParseClass())

    const result = await parser.parse('--class sentinel')
    expect(result.class).toStrictEqual({
      theValue: 'sentinel'
    })
  })

  it('can parse two bools', async () => {
    const parser = new Args(parserOpts)
      .add(['--bool', '-b'], a.Boolean().default(false))
      .add(['--bool2'], a.Boolean().default(false))

    const result = await parser.parse('--bool2 --bool')
    expect(result).toMatchInlineSnapshot(`
{
  "bool": false,
  "bool2": false,
}
`)
  })

  it('can parse schemas with many arguments', async () => {
    const parser = new Args(parserOpts)
      .add(['--class'], new CustomParseClass())
      .add(['--numeric'], a.Number())
      .add(['--str'], a.String().optional())
      .add(['--bool', '-b'], a.Boolean().default(false))

    const result = await parser.parse('--class cls --numeric 123 --bool')
    expect(result).toMatchInlineSnapshot(`
{
  "bool": false,
  "class": {
    "theValue": "cls",
  },
  "numeric": 123,
  "str": undefined,
}
`)
  })

  it('fails when numbers are below lower bounds', async () => {
    const parser = new Args(parserOpts)
      .add(['--number'], a.Number().lowerBound(5))

    await expect(async () => await parser.parse('--number 1')).rejects.toMatchInlineSnapshot(`
[Error: encountered 1 error(s) whilst parsing:

error "'1' is less than lower bound 5" whilst parsing "--number 1" (argument number 1)]
`)
  })

  it('fails when numbers are above upper bounds', async () => {
    const parser = new Args(parserOpts)
      .add(['--number'], a.Number().upperBound(5))

    await expect(async () => await parser.parse('--number 10')).rejects.toMatchInlineSnapshot(`
[Error: encountered 1 error(s) whilst parsing:

error "'10' is greater than upper bound 5" whilst parsing "--number 10" (argument number 1)]
`)
  })

  it('fails when numbers are not in range', async () => {
    const parser = new Args(parserOpts)
      .add(['--number'], a.Number().inRange(10, 20))

    await expect(async () => await parser.parse('--number 3')).rejects.toMatchInlineSnapshot(`
[Error: encountered 1 error(s) whilst parsing:

error "'3' is less than lower bound 10" whilst parsing "--number 3" (argument number 1)]
`)
  })

  it('catches custom callback errors', async () => {
    const parser = new Args(parserOpts)
      .add(['--custom', '-c'], a.Custom(() => {
        throw new Error('Error from custom callback')
      }))

    await expect(async () => await parser.parse('-c this')).rejects.toMatchInlineSnapshot(`[Error: user callback threw error: Error from custom callback]`)
  })

  it('fails when dependencies are not met', async () => {
    const parser = new Args(parserOpts)
      .add(['--numeric'], a.Number().dependsOn('--str'))
      .add(['--str'], a.String().optional())

    await expect(async () => await parser.parse('--numeric 123')).rejects.toMatchInlineSnapshot(`[Error: unmet dependency '--str' for '--numeric']`)
  })
  it('passes when dependencies are met', async () => {
    const parser = new Args(parserOpts)
      .add(['--numeric'], a.Number().dependsOn('--str'))
      .add(['--str'], a.String())

    const result = await parser.parse('--numeric 123 --str test')
    expect(result).toMatchInlineSnapshot(`
{
  "numeric": 123,
  "str": "test",
}
`)
  })
  it('parses arrays with one element', async () => {
    const parser = new Args(parserOpts)
      .add(['--array'], a.Number().array())

    const result = await parser.parse('--array 123')
    expect(result).toMatchInlineSnapshot(`
{
  "array": [
    123,
  ],
}
`)
  })

  it('parses arrays with many elements', async () => {
    const parser = new Args(parserOpts)
      .add(['--array'], a.Number().array())

    const result = await parser.parse('--array 123 783 389 1235')
    expect(result).toMatchInlineSnapshot(`
{
  "array": [
    123,
    783,
    389,
    1235,
  ],
}
`)
  })

  it('fails when an array element has the wrong type', async () => {
    const parser = new Args(parserOpts)
      .add(['--array'], a.Number().array())

    await expect(async () => await parser.parse('--array 123 783 true 1235')).rejects.toMatchInlineSnapshot(`
[Error: encountered 1 error(s) whilst parsing:

error "'true' is not a number" whilst parsing "--array true" (argument number 3)]
`)
  })

  it('parses arrays with of bool', async () => {
    const parser = new Args(parserOpts)
      .add(['--array'], a.Boolean().array())

    const result = await parser.parse('--array true true false false true')
    expect(result).toMatchInlineSnapshot(`
{
  "array": [
    true,
    true,
    false,
    false,
    true,
  ],
}
`)
  })

  it('fails when an array element is above upper bound', async () => {
    const parser = new Args(parserOpts)
      .add(['--array'], a.Number().inRange(100, 1000).array())

    await expect(async () => await parser.parse('--array 123 783 1235')).rejects.toMatchInlineSnapshot(`
[Error: encountered 1 error(s) whilst parsing:

error "'1235' is greater than upper bound 1000" whilst parsing "--array 1235" (argument number 3)]
`)
  })
})
