import { describe, it, expect } from 'bun:test'
import AdmZip from 'adm-zip'
import { validateZipEntries } from '../../src/main/services/zip-entries'
import { mkdtemp, readFile, rm, stat } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

/**
 * Build a real (stored, uncompressed) ZIP by hand. AdmZip's own `addFile`
 * normalizes entry names on write, so a genuinely malicious archive has to be
 * crafted at the byte level - exactly like an archive an attacker would ship.
 */
function rawZip(
  entries: Array<{ name: string; content?: string; externalAttr?: number }>
): Buffer {
  const localChunks: Buffer[] = []
  const centralChunks: Buffer[] = []
  let offset = 0
  for (const e of entries) {
    const nameBuf = Buffer.from(e.name, 'utf8')
    const data = e.content === undefined ? null : Buffer.from(e.content, 'utf8')
    const dataLen = data ? data.length : 0
    const crc = data ? crc32(data) : 0

    const local = Buffer.alloc(30 + nameBuf.length)
    local.writeUInt32LE(0x04034b50, 0) // LOCAL FILE HEADER
    local.writeUInt16LE(20, 4) // version needed
    local.writeUInt16LE(0x0000, 6) // general purpose flag
    local.writeUInt16LE(0, 8) // method: stored
    local.writeUInt16LE(0, 10) // mod time
    local.writeUInt16LE(0x21, 12) // mod date
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(dataLen, 18) // compressed (stored)
    local.writeUInt32LE(dataLen, 22) // uncompressed
    local.writeUInt16LE(nameBuf.length, 26)
    local.writeUInt16LE(0, 28) // extra length
    nameBuf.copy(local, 30)
    localChunks.push(local, data ?? Buffer.alloc(0))

    const central = Buffer.alloc(46 + nameBuf.length)
    central.writeUInt32LE(0x02014b50, 0) // CENTRAL DIRECTORY
    central.writeUInt16LE((3 << 8) | 20, 4) // version made by (unix)
    central.writeUInt16LE(20, 6) // version needed
    central.writeUInt16LE(0x0000, 8)
    central.writeUInt16LE(0, 10)
    central.writeUInt16LE(0, 12)
    central.writeUInt16LE(0x21, 14)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(dataLen, 20)
    central.writeUInt32LE(dataLen, 24)
    central.writeUInt16LE(nameBuf.length, 28)
    central.writeUInt16LE(0, 30) // extra
    central.writeUInt16LE(0, 32) // comment
    central.writeUInt16LE(0, 34) // disk start
    central.writeUInt16LE(0, 36) // internal attrs
    central.writeUInt32LE(e.externalAttr ?? 0, 38) // external attrs
    central.writeUInt32LE(offset, 42) // local header offset
    nameBuf.copy(central, 46)
    centralChunks.push(central)

    offset += 30 + nameBuf.length + dataLen
  }

  const local = Buffer.concat(localChunks)
  const central = Buffer.concat(centralChunks)

  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0) // END OF CENTRAL DIRECTORY
  end.writeUInt16LE(0, 4) // disk
  end.writeUInt16LE(0, 6) // cd start disk
  end.writeUInt16LE(entries.length, 8) // entries on disk
  end.writeUInt16LE(entries.length, 10) // total entries
  end.writeUInt32LE(central.length, 12) // cd size
  end.writeUInt32LE(local.length, 16) // cd offset
  end.writeUInt16LE(0, 20) // comment len

  return Buffer.concat([local, central, end])
}

/** CRC-32 (IEEE 802.3), as used by the ZIP format. */
function crc32(buf: Buffer): number {
  let crc = 0xffffffff
  for (const byte of buf) {
    crc ^= byte
    for (let k = 0; k < 8; k++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

describe('TASK-103 / SEC-02: zip-slip entry validation on backup import', () => {
  it('rejects absolute paths and drive-volume paths', () => {
    const zip = new AdmZip(rawZip([
      { name: 'accounts/a/account.json', content: '{}' },
      { name: '/etc/passwd', content: 'pwned' },
      { name: 'C:\\Windows\\system32\\evil.dll', content: 'pwned' },
      { name: 'D:/outside.txt', content: 'pwned' },
      { name: 'C:relative-host.txt', content: 'pwned' }
    ]))
    const offenders = validateZipEntries(zip.getEntries())
    expect(offenders).toEqual(expect.arrayContaining(['/etc/passwd', 'C:\\Windows\\system32\\evil.dll', 'D:/outside.txt', 'C:relative-host.txt']))
    expect(offenders).not.toContain('accounts/a/account.json')
  })

  it('rejects `..` traversal segments', () => {
    const zip = new AdmZip(rawZip([
      { name: 'contents/c1/content.json', content: '{}' },
      { name: '../../evil.json', content: 'pwned' },
      { name: 'a/../../b/evil.json', content: 'pwned' }
    ]))
    const offenders = validateZipEntries(zip.getEntries())
    expect(offenders).toEqual(expect.arrayContaining(['../../evil.json', 'a/../../b/evil.json']))
    expect(offenders).not.toContain('contents/c1/content.json')
  })

  it('rejects symlink entries via unix external attributes', () => {
    // External attribute 0o120777 << 16 sets the unix S_IFLNK mode type bits.
    const zip = new AdmZip(rawZip([
      { name: 'accounts/a/account.json', content: '{}' },
      { name: 'link-to-out', content: '/etc/passwd', externalAttr: (0o120777 << 16) >>> 0 }
    ]))
    const offenders = validateZipEntries(zip.getEntries())
    expect(offenders).toEqual(expect.arrayContaining(['link-to-out']))
    expect(offenders).not.toContain('accounts/a/account.json')
  })

  it('accepts a clean canonical backup archive', async () => {
    const root = await mkdtemp(join(tmpdir(), 'zip-slip-clean-'))
    try {
      const zip = new AdmZip(rawZip([
        { name: 'accounts/a/account.json', content: JSON.stringify({ id: 'a' }) },
        { name: 'contents/c1/content.json', content: JSON.stringify({ id: 'c1', status: 'draft' }) },
        { name: 'templates/t1/template.html', content: '<h1>hi</h1>' }
      ]))
      expect(validateZipEntries(zip.getEntries())).toEqual([])
      // Sanity: a clean archive actually extracts via AdmZip's own sanitizer.
      zip.extractAllTo(root, true)
      const files = ['accounts/a/account.json', 'contents/c1/content.json', 'templates/t1/template.html']
      for (const f of files) {
        const s = await stat(join(root, f))
        expect(s.size).toBeGreaterThan(0)
      }
      expect(await readFile(join(root, 'contents/c1/content.json'), 'utf-8')).toContain('"status"')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})