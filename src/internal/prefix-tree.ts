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
      if (found.children[key] === undefined) {
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
  }

  delete (key: string): Node<V> | undefined {
    const root = this.base[key[0]]
    if (!root) {
      return undefined
    }

    return this._delete(root, key)
  }

  toString (): string {
    return JSON.stringify(this.base, undefined, 2)
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
  }
}
