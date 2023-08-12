import assert from 'assert'
import { PrefixTree } from '../src/internal/prefix-tree'

describe('Trie tests', () => {
  it('can insert a small string', () => {
    const tree = new PrefixTree<string>()
    tree.insert('prefix', 'value')
    expect(tree).toMatchSnapshot()
  })

  it('can find a small string', () => {
    const tree = new PrefixTree<string>()
    tree.insert('prefix', 'value')

    const search = tree.find('prefix')
    assert(search !== undefined)
    assert(search.didFind)
    expect(search.found).toStrictEqual({
      children: {},
      value: 'value',
      isTerminal: true
    })
  })

  it('can find a string when it has a similar neighbour', () => {
    const tree = new PrefixTree<string>()
    tree.insert('prefix', 'value')
    tree.insert('prefax', 'value2')

    const search = tree.find('prefix')
    assert(search !== undefined)
    assert(search.didFind)
    expect(search.found).toStrictEqual({
      children: {},
      value: 'value',
      isTerminal: true
    })
  })

  it('can provide neighbours for failed searched', () => {
    const tree = new PrefixTree<string>()
    tree.insert('prefix', 'value')

    const search = tree.find('prefia')
    assert(search !== undefined)
    assert(!search.didFind)
    expect(search.previousNode).toStrictEqual({
      children: {
        x: {
          children: {},
          value: 'value',
          isTerminal: true
        }
      },
      value: undefined,
      isTerminal: false
    })
  })

  it('can provide the next values for a partial search', () => {
    const tree = new PrefixTree<string>()
    tree.insert('prefix', 'value')

    const search = tree.find('prefi')
    assert(search !== undefined)
    assert(search.didFind)
    expect(search.found).toStrictEqual({
      children: {
        x: {
          children: {},
          value: 'value',
          isTerminal: true
        }
      },
      value: undefined,
      isTerminal: false
    })
  })
})
