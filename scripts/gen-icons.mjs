import { writeFileSync } from "fs";
import { deflateSync } from "zlib";

function createPNG(size) {
  const canvas = size;
  const data = [];

  for (let y = 0; y < canvas; y++) {
    data.push(0);
    for (let x = 0; x < canvas; x++) {
      const cx = x - canvas / 2;
      const cy = y - canvas / 2;
      const dist = Math.sqrt(cx * cx + cy * cy);
      const radius = canvas * 0.42;

      if (dist < radius) {
        data.push(108, 92, 231, 255);
      } else {
        data.push(10, 10, 10, 255);
      }
    }
  }

  const raw = Buffer.from(data);

  function adler32(buf) {
    let a = 1, b = 0;
    for (let i = 0; i < buf.length; i++) {
      a = (a + buf[i]) % 65521;
      b = (b + a) % 65521;
    }
    return (b << 16) | a;
  }

  function crc32(buf) {
    let c = 0xffffffff;
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let v = i;
      for (let j = 0; j < 8; j++) v = v & 1 ? 0xedb88320 ^ (v >>> 1) : v >>> 1;
      table[i] = v;
    }
    for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeData = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typeData));
    return Buffer.concat([len, typeData, crc]);
  }

  const compressed = deflateSync(raw);

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(canvas, 0);
  ihdr.writeUInt32BE(canvas, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

writeFileSync("public/icon-192.png", createPNG(192));
writeFileSync("public/icon-512.png", createPNG(512));
console.log("Icons generated!");
