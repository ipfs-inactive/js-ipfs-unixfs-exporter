'use strict'

const UnixFS = require('ipfs-unixfs')
const pull = require('pull-stream')
const paramap = require('pull-paramap')
const CID = require('cids')
const waterfall = require('async/waterfall')

const resolvers = {
  directory: require('./dir-flat'),
  'hamt-sharded-directory': require('./dir-hamt-sharded'),
  file: require('./file'),
  object: require('./object'),
  raw: require('./raw')
}

module.exports = Object.assign({
  createResolver: createResolver,
  typeOf: typeOf
}, resolvers)

function createResolver (dag, options, depth, parent) {
  if (!depth) {
    depth = 0
  }

  if (depth > options.maxDepth) {
    return pull.map(identity)
  }

  return pull(
    paramap((item, cb) => {
      if ((typeof item.depth) !== 'number') {
        return pull.error(new Error('no depth'))
      }

      if (item.object) {
        return cb(null, resolveItem(null, item.object, item, options))
      }

      const cid = new CID(item.multihash)

      dag.get(cid, item.pathRest.join('/'), (err, result) => {
        if (err) {
          if (err.message.includes('path not available')) {
            return cb()
          }

          return cb(err)
        }

        const remainder = toPathComponents(result.remainderPath)

        item.name = toPathComponents(item.path).pop()
        item.pathRest = remainder
        item.multihash = result.cid.buffer

        cb(null, resolveItem(result.cid, result.value, item, options))
      })
    }),
    pull.flatten(),
    pull.filter(Boolean),
    pull.filter((node) => node.depth <= options.maxDepth)
  )

  function resolveItem (cid, node, item, options) {
    return resolve({
      cid,
      node,
      name: item.name,
      path: item.path,
      pathRest: item.pathRest,
      size: item.size,
      dag,
      parentNode: item.parent || parent,
      depth: item.depth,
      options
    })
  }

  function resolve ({ cid, node, name, path, pathRest, size, dag, parentNode, depth, options }) {
    let type

    try {
      type = typeOf(node)
    } catch (error) {
      return pull.error(error)
    }

    const nodeResolver = resolvers[type]

    if (!nodeResolver) {
      return pull.error(new Error('Unkown node type ' + type))
    }

    const resolveDeep = createResolver(dag, options, depth, node)

    return nodeResolver(cid, node, name, path, pathRest, resolveDeep, size, dag, parentNode, depth, options)
  }
}

function typeOf (node) {
  if (Buffer.isBuffer(node)) {
    return 'raw'
  } else if (Buffer.isBuffer(node.data)) {
    return UnixFS.unmarshal(node.data).type
  } else {
    return 'object'
  }
}

function identity (o) {
  return o
}

const toPathComponents = (path = '') => {
  // split on / unless escaped with \
  return (path
    .trim()
    .match(/([^\\\][^/]|\\\/)+/g) || [])
    .filter(Boolean)
}
