'use strict'

const hamtShardedDirectoryContent = (cid, node, unixfs, path, resolve, depth, ipld) => {
  return async function * (options = {}) {
    const links = node.Links

    for (const link of links) {
      const name = link.Name.substring(2)

      if (name) {
        const result = await resolve(link.Hash, name, `${path}/${name}`, [], depth + 1, ipld)

        yield result.entry
      } else {
        // descend into subshard
        node = await ipld.get(link.Hash)

        for await (const file of hamtShardedDirectoryContent(link.Hash, node, null, path, resolve, depth, ipld)(options)) {
          yield file
        }
      }
    }
  }
}

module.exports = hamtShardedDirectoryContent
