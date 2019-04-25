'use strict'

const hamtShardedDirectoryContent = (cid, node, unixfs, path, resolve, ipld) => {
  return async function * (options = {}) {
    const links = node.links

    for (const link of links) {
      const name = link.name.substring(2)

      if (name) {
        const result = await resolve(link.cid, name, `${path}/${name}`, [], ipld)

        yield result.entry
      } else {
        // descend into subshard
        node = await ipld.get(link.cid)

        for await (const file of hamtShardedDirectoryContent(link.cid, node, null, path, resolve, ipld)(options)) {
          yield file
        }
      }
    }
  }
}

module.exports = hamtShardedDirectoryContent
