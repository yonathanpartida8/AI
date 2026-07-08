/* ============================================================
 * utils/zip.js — escritor ZIP nativo (sin dependencias)
 *
 * Implementa el formato ZIP (método STORE) con Blob API.
 * La API es compatible en espíritu con JSZip:
 *
 *   const zip = new ZipWriter();
 *   zip.file('index.html', '<!doctype html>…');
 *   zip.file('assets/img/foto.png', uint8Array);
 *   const blob = zip.toBlob();
 *
 * Si se prefiere JSZip (compresión DEFLATE), basta con cambiar
 * la importación en exporter.js: la interfaz .file() es idéntica.
 * ============================================================ */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const time = ((date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1)) & 0xffff;
  const day = (((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()) & 0xffff;
  return { time, day };
}

class ByteWriter {
  constructor() { this.chunks = []; this.length = 0; }
  bytes(arr) { this.chunks.push(arr); this.length += arr.length; }
  u16(v) { this.bytes(new Uint8Array([v & 0xff, (v >> 8) & 0xff])); }
  u32(v) { this.bytes(new Uint8Array([v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >> 24) & 0xff])); }
}

export class ZipWriter {
  #entries = [];

  /** Añade un archivo. data: string | Uint8Array | ArrayBuffer */
  file(path, data) {
    let bytes;
    if (typeof data === 'string') bytes = new TextEncoder().encode(data);
    else if (data instanceof ArrayBuffer) bytes = new Uint8Array(data);
    else bytes = data;
    this.#entries.push({ path: path.replace(/^\/+/, ''), bytes, crc: crc32(bytes) });
    return this;
  }

  toBlob() {
    const w = new ByteWriter();
    const { time, day } = dosDateTime();
    const central = [];

    for (const entry of this.#entries) {
      const nameBytes = new TextEncoder().encode(entry.path);
      const offset = w.length;
      // Local file header
      w.u32(0x04034b50); w.u16(20); w.u16(0x0800 /* UTF-8 */); w.u16(0 /* STORE */);
      w.u16(time); w.u16(day);
      w.u32(entry.crc); w.u32(entry.bytes.length); w.u32(entry.bytes.length);
      w.u16(nameBytes.length); w.u16(0);
      w.bytes(nameBytes); w.bytes(entry.bytes);
      central.push({ ...entry, nameBytes, offset });
    }

    const centralStart = w.length;
    for (const entry of central) {
      w.u32(0x02014b50); w.u16(20); w.u16(20); w.u16(0x0800); w.u16(0);
      w.u16(time); w.u16(day);
      w.u32(entry.crc); w.u32(entry.bytes.length); w.u32(entry.bytes.length);
      w.u16(entry.nameBytes.length); w.u16(0); w.u16(0); w.u16(0); w.u16(0);
      w.u32(0); w.u32(entry.offset);
      w.bytes(entry.nameBytes);
    }
    const centralSize = w.length - centralStart;

    // End of central directory
    w.u32(0x06054b50); w.u16(0); w.u16(0);
    w.u16(central.length); w.u16(central.length);
    w.u32(centralSize); w.u32(centralStart); w.u16(0);

    return new Blob(w.chunks, { type: 'application/zip' });
  }
}
