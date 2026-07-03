/**
 * Union-find (disjoint set) over string keys, with path compression and
 * union by rank. Used to merge wires/pins into electrical nodes — connectivity
 * here must be exact graph connectivity, never proximity guessing.
 */
export class UnionFind {
  private parent = new Map<string, string>()
  private rank = new Map<string, number>()

  add(key: string): void {
    if (!this.parent.has(key)) {
      this.parent.set(key, key)
      this.rank.set(key, 0)
    }
  }

  find(key: string): string {
    this.add(key)
    let root = key
    while (this.parent.get(root) !== root) root = this.parent.get(root)!
    // Path compression
    let cur = key
    while (cur !== root) {
      const next = this.parent.get(cur)!
      this.parent.set(cur, root)
      cur = next
    }
    return root
  }

  union(a: string, b: string): void {
    const ra = this.find(a)
    const rb = this.find(b)
    if (ra === rb) return
    const rankA = this.rank.get(ra)!
    const rankB = this.rank.get(rb)!
    if (rankA < rankB) {
      this.parent.set(ra, rb)
    } else if (rankA > rankB) {
      this.parent.set(rb, ra)
    } else {
      this.parent.set(rb, ra)
      this.rank.set(ra, rankA + 1)
    }
  }

  connected(a: string, b: string): boolean {
    return this.find(a) === this.find(b)
  }

  /** All groups as root → members, with deterministic (sorted) member order. */
  groups(): Map<string, string[]> {
    const out = new Map<string, string[]>()
    for (const key of this.parent.keys()) {
      const root = this.find(key)
      const list = out.get(root)
      if (list) list.push(key)
      else out.set(root, [key])
    }
    for (const list of out.values()) list.sort()
    return out
  }
}
