'use strict'

const directoryContent = (cid, node, unixfs, path, resolve, ipld) => {
  return async function * (options = {}) {
    const offset = options.offset || 0
    const length = options.length || node.links.length
    const links = node.links.slice(offset, length)

    for (const link of links) {
      const result = await resolve(link.cid, link.name, `${path}/${link.name}`, [], ipld)

      yield result.entry
    }
  }
}

module.exports = directoryContent
