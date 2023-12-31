/* eslint-disable @typescript-eslint/quotes */
import { Args, Resolver, a } from '../../src'
import { parserOpts } from '../shared'
import { runArgsExecution } from './utils'

class MockResolver extends Resolver {
  constructor (
    public readonly keyExists: (key: string) => Promise<boolean>,
    public readonly resolveKey: (key: string) => Promise<string>,
    id = 'mock'
  ) {
    super(id)
  }
}

describe('Resolver tests', () => {
  it('calls for resolver when resolving arguments', async () => {
    const existsFn = jest.fn(async (key: string) => key === 'ware')
    const valueFn = jest.fn(async () => 'value')

    const parser = new Args(parserOpts)
      .arg(['--ware'], a.string())
      .resolver(new MockResolver(existsFn, valueFn))

    const result = await runArgsExecution(parser, '')
    expect(result.ware).toBe('value')
    expect(existsFn).toHaveBeenCalled()
    expect(valueFn).toHaveBeenCalled()
  })

  it('rejects invalid resolver values', async () => {
    const existsFn = jest.fn(async (key: string) => key === 'ware')
    const valueFn = jest.fn(async () => 'value')

    const parser = new Args(parserOpts)
      .arg(['--ware'], a.decimal())
      .resolver(new MockResolver(existsFn, valueFn))

    const result = expect(async () => await runArgsExecution(parser, ''))
    await result.rejects.toMatchInlineSnapshot(`[Error: could not parse a 'decimal' because 'value' is not a number, expected 'decimal' received 'value' @ --ware]`)

    expect(existsFn).toHaveBeenCalled()
    expect(valueFn).toHaveBeenCalled()
  })
})
