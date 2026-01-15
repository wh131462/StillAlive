const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Simple PNG generator for solid color icons
function createPNG(width, height, r, g, b, a = 255) {
  // PNG signature
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8);  // bit depth
  ihdrData.writeUInt8(6, 9);  // color type (RGBA)
  ihdrData.writeUInt8(0, 10); // compression
  ihdrData.writeUInt8(0, 11); // filter
  ihdrData.writeUInt8(0, 12); // interlace
  const ihdr = createChunk('IHDR', ihdrData);

  // Create image data with circle shape
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) / 2 - 4;

  const rawData = [];
  for (let y = 0; y < height; y++) {
    rawData.push(0); // filter byte
    for (let x = 0; x < width; x++) {
      const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
      if (dist <= radius) {
        rawData.push(r, g, b, a);
      } else {
        rawData.push(0, 0, 0, 0); // transparent
      }
    }
  }

  // Compress with zlib
  const compressed = zlib.deflateSync(Buffer.from(rawData));
  const idat = createChunk('IDAT', compressed);

  // IEND chunk
  const iend = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuffer, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcData), 0);

  return Buffer.concat([length, typeBuffer, data, crc]);
}

// CRC32 implementation
function crc32(data) {
  let crc = 0xffffffff;
  const table = getCRC32Table();
  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

let crcTable = null;
function getCRC32Table() {
  if (crcTable) return crcTable;
  crcTable = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[i] = c;
  }
  return crcTable;
}

// Icon configurations
const icons = [
  { name: 'home', symbol: 'house' },
  { name: 'calendar', symbol: 'calendar' },
  { name: 'people', symbol: 'people' },
  { name: 'user', symbol: 'user' },
];

// Colors matching tabBar config
const normalColor = { r: 148, g: 163, b: 184 };  // #94a3b8
const activeColor = { r: 15, g: 23, b: 42 };     // #0f172a

const outputDir = path.join(__dirname, '../src/assets/icons');

// Ensure directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Generate icons (81x81 recommended for mini programs)
const size = 81;

icons.forEach(icon => {
  // Normal state
  const normalPng = createPNG(size, size, normalColor.r, normalColor.g, normalColor.b);
  fs.writeFileSync(path.join(outputDir, `${icon.name}.png`), normalPng);
  console.log(`Created: ${icon.name}.png`);

  // Active state
  const activePng = createPNG(size, size, activeColor.r, activeColor.g, activeColor.b);
  fs.writeFileSync(path.join(outputDir, `${icon.name}-active.png`), activePng);
  console.log(`Created: ${icon.name}-active.png`);
});

console.log('\nAll icons generated successfully!');
