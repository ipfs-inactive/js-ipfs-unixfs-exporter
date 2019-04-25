'use strict'

const errCode = require('err-code')

const resolvers = {
  'dag-pb': require('./unixfs-v1'),
  raw: require('./raw'),
  'dag-cbor': require('./dag-cbor')
}

const resolve = (cid, name, path, toResolve, ipld) => {
  const resolver = resolvers[cid.codec]

  if (!resolver) {
    throw errCode(new Error(`No resolver for codec ${cid.codec}`), 'ENORESOLVER')
  }

  return resolver(cid, name, path, toResolve, resolve, ipld)
}

module.exports = resolve
