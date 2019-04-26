'use strict'

const extractDataFromBlock = require('../../../utils/extract-data-from-block')
const validateOffsetAndLength = require('../../../utils/validate-offset-and-length')

const rawContent = async (cid, node, unixfs, path, resolve, ipld) => {
  return async function * (options = {}) {
    const size = node.length

    const {
      offset,
      length
    } = validateOffsetAndLength(size, options.offset, options.length)

    yield extractDataFromBlock(unixfs.data, 0, offset, offset + length)
  }
}

module.exports = rawContent
