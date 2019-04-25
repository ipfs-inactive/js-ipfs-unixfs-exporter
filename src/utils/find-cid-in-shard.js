'use strict'

const Bucket = require('hamt-sharding/src/bucket')
const DirSharded = require('ipfs-unixfs-importer/src/importer/dir-sharded')

const addLinksToHamtBucket = (links, bucket, rootBucket) => {
  return Promise.all(
    links.map(link => {
      if (link.name.length === 2) {
        const pos = parseInt(link.name, 16)

        return bucket._putObjectAt(pos, new Bucket({
          hashFn: DirSharded.hashFn
        }, bucket, pos))
      }

      return rootBucket.put(link.name.substring(2), true)
    })
  )
}

const toPrefix = (position) => {
  return position
    .toString('16')
    .toUpperCase()
    .padStart(2, '0')
    .substring(0, 2)
}

const toBucketPath = (position) => {
  let bucket = position.bucket
  const path = []

  while (bucket._parent) {
    path.push(bucket)

    bucket = bucket._parent
  }

  path.push(bucket)

  return path.reverse()
}

const findShardCid = async (node, name, ipld, context) => {
  if (!context) {
    context = {
      rootBucket: new Bucket({
        hashFn: DirSharded.hashFn
      }),
      hamtDepth: 1
    }

    context.lastBucket = context.rootBucket
  }

  await addLinksToHamtBucket(node.links, context.lastBucket, context.rootBucket)

  const position = await context.rootBucket._findNewBucketAndPos(name)
  let prefix = toPrefix(position.pos)
  const bucketPath = toBucketPath(position)

  if (bucketPath.length > (context.hamtDepth)) {
    context.lastBucket = bucketPath[context.hamtDepth]

    prefix = toPrefix(context.lastBucket._posAtParent)
  }

  const link = node.links.find(link => {
    const entryPrefix = link.name.substring(0, 2)
    const entryName = link.name.substring(2)

    if (entryPrefix !== prefix) {
      // not the entry or subshard we're looking for
      return
    }

    if (entryName && entryName !== name) {
      // not the entry we're looking for
      return
    }

    return true
  })

  if (!link) {
    return null
  }

  if (link.name.substring(2) === name) {
    return link.cid
  }

  context.hamtDepth++

  node = await ipld.get(link.cid)

  return findShardCid(node, name, ipld, context)
}

module.exports = findShardCid
