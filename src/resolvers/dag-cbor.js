'use strict'

const CID = require('cids')
const errCode = require('err-code')

const resolve = async (cid, name, path, toResolve, resolve, ipld) => {
  let node = await ipld.get(cid)
  let subObject = node
  let subPath = path

  while (toResolve.length) {
    const prop = toResolve[0]

    if (prop in subObject) {
      // remove the bit of the path we have resolved
      toResolve.shift()
      subPath = `${subPath}/${prop}`

      if (CID.isCID(subObject[prop])) {
        return {
          entry: {
            name,
            path,
            cid,
            node
          },
          next: {
            cid: subObject[prop],
            name: prop,
            path: subPath,
            toResolve
          }
        }
      }

      subObject = subObject[prop]
    } else {
      // cannot resolve further
      throw errCode(new Error(`No property named ${prop} found in cbor node ${cid.toBaseEncodedString()}`), 'ENOPROP')
    }
  }

  return {
    entry: {
      name,
      path,
      cid,
      node
    }
  }
}

module.exports = resolve
