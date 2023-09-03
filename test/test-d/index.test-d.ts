import { Args, a } from '../../src'
import { ArgType } from '../../src/util'
import { parserOpts } from '../shared'
import { expectAssignable, expectNotAssignable } from 'tsd-lite'

describe('Type testing', () => {
  it('infers single flags', () => {
    const parser = new Args(parserOpts)
      .arg(['--flag'], a.bool())

    expectAssignable<ArgType<typeof parser>>({
      flag: true
    })
  })

  it('infers single optional flags', () => {
    const parser = new Args(parserOpts)
      .arg(['--flag'], a.bool().optional())

    expectAssignable<ArgType<typeof parser>>({
      flag: undefined
    })

    expectAssignable<ArgType<typeof parser>>({
      flag: true
    })
  })

  it('infers decimals', () => {
    const parser = new Args(parserOpts)
      .arg(['--flag'], a.decimal())

    expectAssignable<ArgType<typeof parser>>({
      flag: 1.234
    })
  })

  it('infers bigints', () => {
    const parser = new Args(parserOpts)
      .arg(['--flag'], a.bigint())

    expectAssignable<ArgType<typeof parser>>({
      flag: 4237483712724837284728423n
    })
  })

  it('infers strings', () => {
    const parser = new Args(parserOpts)
      .arg(['--flag'], a.string())

    expectAssignable<ArgType<typeof parser>>({
      flag: 'hello'
    })
  })

  it('infers callback types', () => {
    const customCallback = (value: string) => ({
      ok: true,
      passedValue: value,
      returnedValue: 'custom value'
    } as const)

    const parser = new Args(parserOpts)
      .arg(['--flag'], a.custom(customCallback))

    expectAssignable<ArgType<typeof parser>>({
      flag: 'custom value' as const
    })
  })

  it('infers single positionals', () => {
    const parser = new Args(parserOpts)
      .positional('<flag>', a.bool())

    expectAssignable<ArgType<typeof parser>>({
      flag: true
    })
  })

  it('infers single optional positionals', () => {
    const parser = new Args(parserOpts)
      .positional('<flag>', a.bool().optional())

    expectAssignable<ArgType<typeof parser>>({
      flag: true
    })

    expectAssignable<ArgType<typeof parser>>({
      flag: undefined
    })
  })

  it('infers single flag arrays', () => {
    const parser = new Args(parserOpts)
      .arg(['--flag'], a.string().array())

    expectAssignable<ArgType<typeof parser>>({
      flag: ['hello']
    })

    expectNotAssignable<ArgType<typeof parser>>({
      flag: 'hello'
    })
  })

  it('infers unions with 2 types', () => {
    const parser = new Args(parserOpts)
      .arg(['--union'], a.number().or(a.bool()))

    expectAssignable<ArgType<typeof parser>>({
      union: 1
    })

    expectAssignable<ArgType<typeof parser>>({
      union: true
    })
  })

  it('infers unions with 3 types', () => {
    const parser = new Args(parserOpts)
      .arg(['--union'], a.number().or(a.bool()).or(a.string()))

    expectAssignable<ArgType<typeof parser>>({
      union: 1
    })

    expectAssignable<ArgType<typeof parser>>({
      union: true
    })

    expectAssignable<ArgType<typeof parser>>({
      union: 'string'
    })
  })

  it('infers string unions', () => {
    const parser = new Args(parserOpts)
      .arg(['--union'], a.oneOf('a', 'b', 'c'))

    expectAssignable<ArgType<typeof parser>>({
      union: 'a' as const
    })

    expectAssignable<ArgType<typeof parser>>({
      union: 'b' as const
    })

    expectAssignable<ArgType<typeof parser>>({
      union: 'c' as const
    })

    expectNotAssignable<ArgType<typeof parser>>({
      union: 'd'
    })
  })
})
