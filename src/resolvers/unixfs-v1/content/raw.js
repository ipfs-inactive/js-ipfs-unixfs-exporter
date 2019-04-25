'use strict'

const errCode = require('err-code')
const extractDataFromBlock = require('../../../utils/extract-data-from-block')
const toIterator = require('pull-stream-to-async-iterator')
const once = require('pull-stream/sources/once')

const rawContent = async (cid, node, unixfs, path, resolve, ipld) => {
  return (options = {}) => {
    const size = node.length

    let offset = options.offset
    let length = options.length

    if (offset < 0) {
      throw errCode(new Error('Offset must be greater than or equal to 0'), 'EINVALIDPARAMS')
    }

    if (offset > size) {
      throw errCode(new Error('Offset must be less than the file size'), 'EINVALIDPARAMS')
    }

    if (length < 0) {
      throw errCode(new Error('Length must be greater than or equal to 0'), 'EINVALIDPARAMS')
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

    return toIterator(once(extractDataFromBlock(unixfs.data, 0, offset, offset + length)))
  }
}

module.exports = rawContent
