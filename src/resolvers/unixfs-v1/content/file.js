'use strict'

const extractDataFromBlock = require('../../../utils/extract-data-from-block')
const toIterator = require('pull-stream-to-async-iterator')
const traverse = require('pull-traverse')
const UnixFS = require('ipfs-unixfs')
const pull = require('pull-stream/pull')
const error = require('pull-stream/sources/error')
const once = require('pull-stream/sources/once')
const empty = require('pull-stream/sources/empty')
const filter = require('pull-stream/throughs/filter')
const flatten = require('pull-stream/throughs/flatten')
const map = require('pull-stream/throughs/map')
const paramap = require('pull-paramap')
const errCode = require('err-code')

function streamBytes (ipld, node, fileSize, { offset, length }) {
  if (offset === fileSize || length === 0) {
    return once(Buffer.alloc(0))
  }

  if (!offset) {
    offset = 0
  }

  if (!length) {
    length = fileSize
  }

  if (offset < 0) {
    return error(errCode(new Error('Offset must be greater than or equal to 0'), 'EINVALIDPARAMS'))
  }

  if (offset > fileSize) {
    return error(errCode(new Error('Offset must be less than the file size'), 'EINVALIDPARAMS'))
  }

  if (length < 0) {
    return error(errCode(new Error('Length must be greater than or equal to 0'), 'EINVALIDPARAMS'))
  }

  const end = offset + length

  return pull(
    traverse.depthFirst({
      node,
      start: 0,
      end: fileSize
    }, getChildren(ipld, offset, end)),
    map(extractData(offset, end)),
    filter(Boolean)
  )
}

function getChildren (dag, offset, end) {
  // as we step through the children, keep track of where we are in the stream
  // so we can filter out nodes we're not interested in
  let streamPosition = 0

  return function visitor ({ node }) {
    if (Buffer.isBuffer(node)) {
      // this is a leaf node, can't traverse any further
      return empty()
    }

    let file

    try {
      file = UnixFS.unmarshal(node.data)
    } catch (err) {
      return error(err)
    }

    const nodeHasData = Boolean(file.data && file.data.length)

    // handle case where data is present on leaf nodes and internal nodes
    if (nodeHasData && node.links.length) {
      streamPosition += file.data.length
    }

    // work out which child nodes contain the requested data
    const filteredLinks = node.links
      .map((link, index) => {
        const child = {
          link: link,
          start: streamPosition,
          end: streamPosition + file.blockSizes[index],
          size: file.blockSizes[index]
        }

        streamPosition = child.end

        return child
      })
      .filter((child) => {
        return (offset >= child.start && offset < child.end) || // child has offset byte
          (end > child.start && end <= child.end) || // child has end byte
          (offset < child.start && end > child.end) // child is between offset and end bytes
      })

    if (filteredLinks.length) {
      // move stream position to the first node we're going to return data from
      streamPosition = filteredLinks[0].start
    }

    return pull(
      once(filteredLinks),
      paramap(async (children, cb) => {
        try {
          let results = []

          for await (const result of await dag.getMany(children.map(child => child.link.cid))) {
            const child = children[results.length]

            results.push({
              start: child.start,
              end: child.end,
              node: result,
              size: child.size
            })
          }

          cb(null, results)
        } catch (err) {
          cb(err)
        }
      }),
      flatten()
    )
  }
}

function extractData (requestedStart, requestedEnd) {
  let streamPosition = -1

  return function getData ({ node, start, end }) {
    let block

    if (Buffer.isBuffer(node)) {
      block = node
    } else {
      try {
        const file = UnixFS.unmarshal(node.data)

        if (!file.data) {
          if (file.blockSizes.length) {
            return
          }

          return Buffer.alloc(0)
        }

        block = file.data
      } catch (err) {
        throw new Error(`Failed to unmarshal node - ${err.message}`)
      }
    }

    if (block && block.length) {
      if (streamPosition === -1) {
        streamPosition = start
      }

      const output = extractDataFromBlock(block, streamPosition, requestedStart, requestedEnd)

      streamPosition += block.length

      return output
    }

    return Buffer.alloc(0)
  }
}

const fileContent = (cid, node, unixfs, path, resolve, ipld) => {
  return (options = {}) => {
    return toIterator(streamBytes(ipld, node, unixfs.fileSize(), options))
  }
}

module.exports = fileContent
