import { Args, a } from '../../src'
import { ArgType } from '../../src/util'
import { parserOpts } from '../shared'
import { expectAssignable } from 'tsd-lite'

describe('Type testing', () => {
  it('infers basic flags', () => {
    const parser = new Args(parserOpts)
      .arg(['--flag'], a.bool())

    expectAssignable<ArgType<typeof parser>>({
      flag: true
    })
  })
})
