'use strict'

const errCode = require('err-code')
const extractDataFromBlock = require('../utils/extract-data-from-block')
const validateOffsetAndLength = require('../utils/validate-offset-and-length')

const rawContent = (node) => {
  return async function * (options = {}) {
    const {
      offset,
      length
    } = validateOffsetAndLength(node.length, options.offset, options.length)

    yield extractDataFromBlock(node, 0, offset, offset + length)
  }
}

const resolve = async (cid, name, path, toResolve, resolve, ipld) => {
  const node = await ipld.get(cid)

  if (!Buffer.isBuffer(node)) {
    throw errCode(new Error(`'${cid.codec}' node ${cid.toBaseEncodedString()} was not a buffer`), 'ENOBUF')
  }

  if (toResolve.length) {
    throw errCode(new Error(`No link named ${path} found in raw node ${cid.toBaseEncodedString()}`), 'ENOLINK')
  }

  return {
    entry: {
      name,
      path,
      cid,
      node,
      content: rawContent(node)
    }
  }
}

module.exports = resolve
