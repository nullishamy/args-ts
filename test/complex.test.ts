/* eslint-disable @typescript-eslint/quotes */
import { parserOpts } from '.'
import { Parser } from '../src'
import { a, Argument, ParseResult } from '../src/builder'

class CustomParseClass extends Argument<{ thatValue: string }> {
  constructor () {
    super('custom')
  }

  public parse (value: string): ParseResult<{ thatValue: string }> {
    return {
      ok: true,
      oldValue: value,
      parsedValue: {
        thatValue: value
      }
    }
  }
}

class AsyncParseClass extends Argument<{ asyncMe: string }> {
  constructor () {
    super('custom')
  }

  public async parse (value: string): Promise<ParseResult<{ asyncMe: string }>> {
    return {
      ok: true,
      oldValue: value,
      parsedValue: {
        asyncMe: value
      }
    }
  }
}

describe('Complex parsing', () => {
  it('can utilise custom classes in arguments', async () => {
    const parser = new Parser(parserOpts)
      .add(['--class'], new CustomParseClass())

    const result = await parser.parse('--class sentinel')
    expect(result.class).toStrictEqual({
      thatValue: 'sentinel'
    })
  })

  it('can utilise async classes in arguments', async () => {
    const parser = new Parser(parserOpts)
      .add(['--async'], new AsyncParseClass())

    const result = await parser.parse('--async sentinel')
    expect(result.async).toStrictEqual({
      asyncMe: 'sentinel'
    })
  })

  it('can parse schemas with many arguments', async () => {
    const parser = new Parser(parserOpts)
      .add(['--async'], new AsyncParseClass())
      .add(['--class'], new CustomParseClass())
      .add(['--numeric'], a.Number())
      .add(['--str'], a.String().optional())
      .add(['--bool', '-b'], a.Boolean().default(false))

    const result = await parser.parse('--async sentinel --class cls --numeric 123 -b')
    expect(result).toMatchInlineSnapshot(`
{
  "async": {
    "asyncMe": "sentinel",
  },
  "bool": false,
  "class": {
    "thatValue": "cls",
  },
  "numeric": 123,
  "str": undefined,
}
`)
  })

  it('fails when numbers are below lower bounds', async () => {
    const parser = new Parser(parserOpts)
      .add(['--number'], a.Number().lowerBound(5))

    await expect(async () => await parser.parse('--number 1')).rejects.toMatchInlineSnapshot(`[Error: encountered error whilst parsing: '1' is less than lower bound 5]`)
  })

  it('fails when numbers are above upper bounds', async () => {
    const parser = new Parser(parserOpts)
      .add(['--number'], a.Number().upperBound(5))

    await expect(async () => await parser.parse('--number 10')).rejects.toMatchInlineSnapshot(`[Error: encountered error whilst parsing: '10' is greater than upper bound 5]`)
  })

  it('fails when numbers are not in range', async () => {
    const parser = new Parser(parserOpts)
      .add(['--number'], a.Number().inRange(10, 20))

    await expect(async () => await parser.parse('--number 3')).rejects.toMatchInlineSnapshot(`[Error: encountered error whilst parsing: '3' is less than lower bound 10]`)
  })

  it('catches custom callback errors', async () => {
    const parser = new Parser(parserOpts)
      .add(['--custom', '-c'], a.Custom(() => {
        throw new Error('Error from custom callback')
      }))

    await expect(async () => await parser.parse('-c this')).rejects.toMatchInlineSnapshot(`[Error: user callback threw error: Error from custom callback]`)
  })

  it('fails when dependencies are not met', async () => {
    const parser = new Parser(parserOpts)
      .add(['--numeric'], a.Number().dependsOn('--str'))
      .add(['--str'], a.String().optional())

    await expect(async () => await parser.parse('--numeric 123')).rejects.toMatchInlineSnapshot(`[Error: unmet dependency '--str' for '--numeric']`)
  })
  it('passes when dependencies are met', async () => {
    const parser = new Parser(parserOpts)
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
})
