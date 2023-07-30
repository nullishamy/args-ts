/* eslint-disable @typescript-eslint/quotes */
import { parserOpts, runArgsExecution } from '.'
import { Args } from '../src'
import { a, Argument, CoercionResult } from '../src/builder'

class CustomParseClass extends Argument<{ theValue: string }> {
  constructor () {
    super('custom')
  }

  public async coerce (value: string): Promise<CoercionResult<{ theValue: string }>> {
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

    const result = await runArgsExecution(parser, '--class sentinel')
    expect(result.class).toStrictEqual({
      theValue: 'sentinel'
    })
  })

  it('can parse two bools', async () => {
    const parser = new Args(parserOpts)
      .add(['--bool', '-b'], a.bool().default(false))
      .add(['--bool2'], a.bool().default(false))

    const result = await runArgsExecution(parser, '--bool2 --bool')
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
      .add(['--numeric'], a.number())
      .add(['--str'], a.string().optional())
      .add(['--bool', '-b'], a.bool().default(false))

    const result = await runArgsExecution(parser, '--class cls --numeric 123 --bool')
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
      .add(['--number'], a.number().lowerBound(5))

    await expect(async () => await runArgsExecution(parser, '--number 1')).rejects.toMatchInlineSnapshot(`[Error: Err(CoercionError { encountered error: \`1 is less than lower bound 5\` when coercing "--number 1" })]`)
  })

  it('fails when numbers are above upper bounds', async () => {
    const parser = new Args(parserOpts)
      .add(['--number'], a.number().upperBound(5))

    await expect(async () => await runArgsExecution(parser, '--number 10')).rejects.toMatchInlineSnapshot(`[Error: Err(CoercionError { encountered error: \`10 is greater than upper bound 5\` when coercing "--number 10" })]`)
  })

  it('fails when numbers are not in range', async () => {
    const parser = new Args(parserOpts)
      .add(['--number'], a.number().inRange(10, 20))

    await expect(async () => await runArgsExecution(parser, '--number 3')).rejects.toMatchInlineSnapshot(`[Error: Err(CoercionError { encountered error: \`3 is less than lower bound 10\` when coercing "--number 3" })]`)
  })

  it('catches custom callback errors', async () => {
    const parser = new Args(parserOpts)
      .add(['--custom', '-c'], a.custom(() => {
        throw new Error('Error from custom callback')
      }))

    await expect(async () => await runArgsExecution(parser, '-c this')).rejects.toMatchInlineSnapshot(`[Error: Error from custom callback]`)
  })

  it('fails when dependencies are not met', async () => {
    const parser = new Args(parserOpts)
      .add(['--numeric'], a.number().dependsOn('--str'))
      .add(['--str'], a.string().optional())

    await expect(async () => await runArgsExecution(parser, '--numeric 123')).rejects.toMatchInlineSnapshot(`[Error: Err(CoercionError { unmet dependency '--str' for '--numeric' })]`)
  })
  it('passes when dependencies are met', async () => {
    const parser = new Args(parserOpts)
      .add(['--numeric'], a.number().dependsOn('--str'))
      .add(['--str'], a.string())

    const result = await runArgsExecution(parser, '--numeric 123 --str test')
    expect(result).toMatchInlineSnapshot(`
{
  "numeric": 123,
  "str": "test",
}
`)
  })
  it('parses arrays with one element', async () => {
    const parser = new Args(parserOpts)
      .add(['--array'], a.number().array())

    const result = await runArgsExecution(parser, '--array 123')
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
      .add(['--array'], a.number().array())

    const result = await runArgsExecution(parser, '--array 123 783 389 1235')

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
      .add(['--array'], a.number().array())

    await expect(async () => await runArgsExecution(parser, '--array 123 783 true 1235')).rejects.toMatchInlineSnapshot(`
[Error: Err(CoercionError { encountered 1 error(s) during coercion:

error: \`'true' is not a number\` whilst parsing "--array true" (argument number 3) })]
`)
  })

  it('parses arrays with of bool', async () => {
    const parser = new Args(parserOpts)
      .add(['--array'], a.bool().array())

    const result = await runArgsExecution(parser, '--array true true false false true')
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
      .add(['--array'], a.number().inRange(100, 1000).array())

    await expect(async () => await runArgsExecution(parser, '--array 123 783 1235')).rejects.toMatchInlineSnapshot(`
[Error: Err(CoercionError { encountered 1 error(s) during coercion:

error: \`1235 is greater than upper bound 1000\` whilst parsing "--array 1235" (argument number 3) })]
`)
  })
})
