/* eslint-disable @typescript-eslint/quotes */
import { Args, Middleware, a } from '../../src'
import { parserOpts } from '../shared'
import { runArgsExecution } from './utils'

class MockMiddleware extends Middleware {
  constructor (
    public readonly keyExists: (key: string) => boolean,
    public readonly resolveKey: (key: string) => string | undefined,
    id = 'mock'
  ) {
    super(id)
  }
}

describe('Middleware tests', () => {
  it('calls for middleware when resolving arguments', async () => {
    const existsFn = jest.fn((key: string) => key === 'ware')
    const valueFn = jest.fn(() => 'value')

    const parser = new Args(parserOpts)
      .arg(['--ware'], a.string())
      .middleware(new MockMiddleware(existsFn, valueFn))

    const result = await runArgsExecution(parser, '')
    expect(result.ware).toBe('value')
    expect(existsFn).toHaveBeenCalled()
    expect(valueFn).toHaveBeenCalled()
  })

  it('rejects invalid middleware values', async () => {
    const existsFn = jest.fn((key: string) => key === 'ware')
    const valueFn = jest.fn(() => 'value')

    const parser = new Args(parserOpts)
      .arg(['--ware'], a.decimal())
      .middleware(new MockMiddleware(existsFn, valueFn))

    const result = expect(async () => await runArgsExecution(parser, ''))
    await result.rejects.toMatchInlineSnapshot(`[Error: could not parse a 'decimal' because 'value' is not a number, expected 'decimal' received 'value' @ --ware]`)

    expect(existsFn).toHaveBeenCalled()
    expect(valueFn).toHaveBeenCalled()
  })
})
