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
  const buf = await ipld.get(cid)

  if (toResolve.length) {
    throw errCode(new Error(`No link named ${path} found in raw node ${cid.toBaseEncodedString()}`), 'ENOTFOUND')
  }

  return {
    entry: {
      name,
      path,
      cid,
      node: buf,
      content: rawContent(buf)
    }
  }
}

module.exports = resolve
