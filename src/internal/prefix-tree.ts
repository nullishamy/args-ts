interface Node<T> {
  children: Record<string, Node<T> | undefined>
  value: T | undefined
  isTerminal: boolean
}

interface SearchHit<T> {
  didFind: true
  found: Node<T>
}

interface SearchMissed<T> {
  didFind: false
  previousNode: Node<T>
}

export class PrefixTree<V> {
  private readonly base: Record<string, Node<V> | undefined> = {}
  private size = 0

  find (key: string): SearchHit<V> | SearchMissed<V> | undefined {
    let found = this.base[key[0]]

    if (!found) {
      return undefined
    }

    for (const char of key.substring(1)) {
      const next: Node<V> | undefined = found.children[char]

      if (next) {
        found = next
      } else {
        return {
          didFind: false,
          previousNode: found
        }
      }
    }

    return {
      didFind: true,
      found
    }
  }

  findOrUndefined (key: string): V | undefined {
    const find = this.find(key)
    if (find?.didFind && find?.found.isTerminal) {
      return find.found.value
    }

    return undefined
  }

  has (key: string): boolean {
    const find = this.find(key)
    // A search returned, and it is terminal (not a partial match)
    // Or, if no search was found, false
    return (find?.didFind && find?.found.isTerminal) ?? false
  }

  insert (key: string, value: V): void {
    let found = this.base[key[0]]
    if (!found) {
      found = {
        children: {},
        value: undefined,
        isTerminal: false
      }

      this.base[key[0]] = found
    }

    for (const char of key.substring(1)) {
      if (found.children[char] === undefined) {
        found.children[char] = {
          children: {},
          value: undefined,
          isTerminal: false
        }
      }

      found = found.children[char]
      if (!found) {
        throw new Error('impossible, no node found')
      }
    }

    found.value = value
    found.isTerminal = true
    this.size++
  }

  delete (key: string): Node<V> | undefined {
    const root = this.base[key[0]]
    if (!root) {
      return undefined
    }

    const result = this._delete(root, key.substring(1))

    if (result) {
      this.size--
    }

    return result
  }

  toString (): string {
    return JSON.stringify(this.base, undefined, 2)
  }

  empty (): boolean {
    return this.size === 0
  }

  private _delete (node: Node<V>, key: string): Node<V> | undefined {
    if (key.length === 0) {
      if (node.isTerminal) {
        node.isTerminal = false
        node.value = undefined
      }

      if (node.children.size) {
        return node
      }

      return undefined
    }

    const newChild = node.children[key[0]]
    if (!newChild) {
      throw new Error(`no child for key ${key}`)
    }

    node.children[key[0]] = this._delete(newChild, key.substring(1))
    return node
  }
}
