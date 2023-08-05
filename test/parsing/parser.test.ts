import { lexAndParse, makeInternalCommand } from './utils'

describe('Parser tests', () => {
  const opts = {
    excessArgBehaviour: 'throw',
    unknownArgBehaviour: 'throw',
    programDescription: '',
    programName: ''
  } as const

  it('parses command roots', () => {
    const parsed = lexAndParse('cmd', opts, [
      makeInternalCommand({
        name: 'cmd',
        opts
      })
    ])

    expect(parsed.command).toMatchObject({
      internal: {
        name: 'cmd',
        aliases: []
      },
      isDefault: false,
      keyParts: ['cmd']
    })
    expect(parsed.flags).toEqual(new Map())
    expect(parsed.positionals).toEqual(new Map())
  })

  it('parses primary subcommands', () => {
    const parsed = lexAndParse('cmd subcmd', opts, [
      makeInternalCommand({
        name: 'cmd',
        opts,
        subcommands: {
          subcmd: makeInternalCommand({
            name: 'subcmd',
            opts
          })
        }
      })
    ])

    expect(parsed.command).toMatchObject({
      internal: {
        name: 'subcmd',
        aliases: []
      },
      isDefault: false,
      keyParts: ['cmd', 'subcmd']
    })
    expect(parsed.flags).toEqual(new Map())
    expect(parsed.positionals).toEqual(new Map())
  })

  it('parses secondary subcommands', () => {
    const parsed = lexAndParse('cmd subcmd subsubcmd', opts, [
      makeInternalCommand({
        name: 'cmd',
        opts,
        subcommands: {
          subcmd: makeInternalCommand({
            name: 'subcmd',
            opts,
            subcommands: {
              subsubcmd: makeInternalCommand({
                name: 'subsubcmd',
                opts
              })
            }
          })
        }
      })
    ])

    expect(parsed.command).toMatchObject({
      internal: {
        name: 'subsubcmd',
        aliases: []
      },
      isDefault: false,
      keyParts: ['cmd', 'subcmd', 'subsubcmd']
    })
    expect(parsed.flags).toEqual(new Map())
    expect(parsed.positionals).toEqual(new Map())
  })

  it('parses empty args', () => {
    const parsed = lexAndParse('', opts, [])

    expect(parsed.command).toEqual({
      isDefault: true
    })
    expect(parsed.flags).toEqual(new Map())
    expect(parsed.positionals).toEqual(new Map())
  })

  it('parses unknown subcommands into positional arguments', () => {
    const parsed = lexAndParse('cmd positional', opts, [
      makeInternalCommand({
        name: 'cmd',
        opts
      })
    ])

    expect(parsed.command).toMatchObject({
      internal: {
        name: 'cmd',
        aliases: []
      },
      isDefault: false,
      keyParts: ['cmd']
    })
    expect(parsed.flags).toEqual(new Map())
    expect(parsed.positionals).toEqual(new Map([
      [0, {
        index: 0,
        type: 'positional',
        rawInput: 'positional',
        values: ['positional']
      }]
    ]))
  })

  it('parses unknown root command into positional arguments', () => {
    const parsed = lexAndParse('positional', opts, [])

    expect(parsed.command).toMatchObject({
      isDefault: true
    })
    expect(parsed.flags).toEqual(new Map())
    expect(parsed.positionals).toEqual(new Map([
      [0, {
        index: 0,
        type: 'positional',
        rawInput: 'positional',
        values: ['positional']
      }]
    ]))
  })

  it('parses many positionals into positional arguments', () => {
    const parsed = lexAndParse('pos1 pos2 pos3', opts, [])

    expect(parsed.command).toMatchObject({
      isDefault: true
    })
    expect(parsed.flags).toEqual(new Map())
    expect(parsed.positionals).toEqual(new Map([
      [0, {
        index: 0,
        type: 'positional',
        rawInput: 'pos1',
        values: ['pos1']
      }],
      [1, {
        index: 1,
        rawInput: 'pos2',
        type: 'positional',
        values: ['pos2']
      }],
      [2, {
        index: 2,
        rawInput: 'pos3',
        type: 'positional',
        values: ['pos3']
      }]
    ]))
  })

  it('parses a single long flags without a value', () => {
    const parsed = lexAndParse('--test', opts, [])

    expect(parsed.command).toMatchObject({
      isDefault: true
    })
    expect(parsed.flags).toEqual(new Map([
      ['test', {
        key: 'test',
        values: [],
        rawInput: '--test',
        type: 'long'
      }]
    ]))
    expect(parsed.positionals).toEqual(new Map())
  })

  it('parses a single long flag with an unquoted value', () => {
    const parsed = lexAndParse('--test value', opts, [])

    expect(parsed.command).toMatchObject({
      isDefault: true
    })
    expect(parsed.flags).toEqual(new Map([
      ['test', {
        key: 'test',
        values: ['value'],
        rawInput: '--test value',
        type: 'long'
      }]
    ]))
    expect(parsed.positionals).toEqual(new Map())
  })

  it('parses many long flags without a value', () => {
    const parsed = lexAndParse('--test --test2', opts, [])

    expect(parsed.command).toMatchObject({
      isDefault: true
    })
    expect(parsed.flags).toEqual(new Map([
      ['test', {
        key: 'test',
        values: [],
        rawInput: '--test',
        type: 'long'
      }],
      ['test2', {
        key: 'test2',
        values: [],
        rawInput: '--test2',
        type: 'long'
      }]
    ]))
    expect(parsed.positionals).toEqual(new Map())
  })

  it('parses many long flags with unquoted values', () => {
    const parsed = lexAndParse('--test value1 --test2 value2', opts, [])

    expect(parsed.command).toMatchObject({
      isDefault: true
    })
    expect(parsed.flags).toEqual(new Map([
      ['test', {
        key: 'test',
        values: ['value1'],
        rawInput: '--test value1',
        type: 'long'
      }],
      ['test2', {
        key: 'test2',
        values: ['value2'],
        rawInput: '--test2 value2',
        type: 'long'
      }]
    ]))
    expect(parsed.positionals).toEqual(new Map())
  })

  it('parses a short flag argument with no value', () => {
    const parsed = lexAndParse('-t', opts, [])

    expect(parsed.command).toMatchObject({
      isDefault: true
    })
    expect(parsed.flags).toEqual(new Map([
      ['t', {
        key: 't',
        values: [],
        rawInput: '-t',
        type: 'short-single'
      }]
    ]))
    expect(parsed.positionals).toEqual(new Map())
  })

  it('parses a short flag argument with a value', () => {
    const parsed = lexAndParse('-t value', opts, [])

    expect(parsed.command).toMatchObject({
      isDefault: true
    })
    expect(parsed.flags).toEqual(new Map([
      ['t', {
        key: 't',
        values: ['value'],
        rawInput: '-t value',
        type: 'short-single'
      }]
    ]))
    expect(parsed.positionals).toEqual(new Map())
  })

  it('parses a single long flag with a quoted value', () => {
    const parsed = lexAndParse('--test "value goes here"', opts, [])

    expect(parsed.command).toMatchObject({
      isDefault: true
    })
    expect(parsed.flags).toEqual(new Map([
      ['test', {
        key: 'test',
        values: ['value goes here'],
        rawInput: '--test value goes here',
        type: 'long'
      }]
    ]))
    expect(parsed.positionals).toEqual(new Map())
  })
})
