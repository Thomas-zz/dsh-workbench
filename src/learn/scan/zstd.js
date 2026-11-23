// zstd 文件解码：DSH 会话是「每次 flush 追加一帧」的多帧容器，zlib 只解第一帧，
// 所以照 dsh-offpeak-queue/host/repair.js 的做法先按帧头切分再逐帧解压。
// Node 24 自带 zlib.zstdDecompressSync；没有时退回 zstd CLI。
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import zlib from 'node:zlib'

const ZSTD_MAGIC = 0xfd2fb528
const ZSTD_SKIPPABLE_MASK = 0xfffffff0
const ZSTD_SKIPPABLE = 0x184d2a50

/**
 * 定位多帧 zstd 容器里每一帧的字节区间（只走帧头/块头结构，不解码数据块）。
 * @param {Buffer} buffer
 * @returns {Array<{start: number, end: number}>}
 */
export function splitZstdFrames(buffer) {
  const frames = []
  let offset = 0
  while (offset + 4 <= buffer.length) {
    const magic = buffer.readUInt32LE(offset)
    if ((magic & ZSTD_SKIPPABLE_MASK) === ZSTD_SKIPPABLE) {
      if (offset + 8 > buffer.length) throw new Error('truncated skippable frame')
      offset += 8 + buffer.readUInt32LE(offset + 4)
      continue
    }
    if (magic !== ZSTD_MAGIC) throw new Error(`bad frame magic at byte ${offset}`)
    const start = offset
    offset += 4
    if (offset >= buffer.length) throw new Error('truncated frame header')
    const descriptor = buffer[offset]
    offset += 1
    const contentSizeFlag = descriptor >> 6
    const singleSegment = (descriptor >> 5) & 1
    const checksum = (descriptor >> 2) & 1
    const dictionaryFlag = descriptor & 3
    if (singleSegment === 0) offset += 1
    offset += [0, 1, 2, 4][dictionaryFlag]
    offset += singleSegment === 1 ? [1, 2, 4, 8][contentSizeFlag] : [0, 2, 4, 8][contentSizeFlag]
    for (;;) {
      if (offset + 3 > buffer.length) throw new Error('truncated block header')
      const header = buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16)
      offset += 3
      const last = header & 1
      const type = (header >> 1) & 3
      const size = header >> 3
      offset += type === 1 ? 1 : size
      if (last === 1) break
    }
    if (checksum === 1) offset += 4
    if (offset > buffer.length) throw new Error('truncated frame')
    frames.push({ start, end: offset })
  }
  if (frames.length === 0) throw new Error('no Zstandard frame found')
  return frames
}

/**
 * 读一个 zstd 压缩文件并解出全部文本；单帧文件也走同一条路。
 * @param {string} file - .zst / .zstd 文件路径。
 * @returns {string} UTF-8 文本。
 */
export function decodeZstdFile(file) {
  if (typeof zlib.zstdDecompressSync !== 'function') {
    return execFileSync('zstd', ['-dc', file], { maxBuffer: 512 * 1024 * 1024 }).toString('utf8')
  }
  const raw = readFileSync(file)
  const parts = []
  for (const frame of splitZstdFrames(raw)) {
    parts.push(zlib.zstdDecompressSync(raw.subarray(frame.start, frame.end)))
  }
  return Buffer.concat(parts).toString('utf8')
}
