'use strict'

const errCode = require('err-code')
const extractDataFromBlock = require('../utils/extract-data-from-block')
const toIterator = require('pull-stream-to-async-iterator')
const once = require('pull-stream/sources/once')
const error = require('pull-stream/sources/error')

const rawContent = (node) => {
  return (options = {}) => {
    const size = node.length

    let offset = options.offset
    let length = options.length

    if (offset < 0) {
      return toIterator(error(errCode(new Error('Offset must be greater than or equal to 0'), 'EINVALIDPARAMS')))
    }

    if (offset > size) {
      return toIterator(error(errCode(new Error('Offset must be less than the file size'), 'EINVALIDPARAMS')))
    }

    if (length < 0) {
      return toIterator(error(errCode(new Error('Length must be greater than or equal to 0'), 'EINVALIDPARAMS')))
    }

    if (length === 0) {
      return toIterator(once(Buffer.alloc(0)))
    }

    if (!offset) {
      offset = 0
    }

    if (!length || (offset + length > size)) {
      length = size - offset
    }

    return toIterator(once(extractDataFromBlock(node, 0, offset, offset + length)))
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
