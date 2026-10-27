// Gera os ícones do app (livro aberto) sem dependências: node scripts/make-icons.mjs
import fs from 'node:fs';
import zlib from 'node:zlib';

const OUT = new URL('../assets/images/', import.meta.url);
const ACCENT = [0x3b, 0x6e, 0xf5];
const WHITE = [0xff, 0xff, 0xff];

// páginas do livro numa grade de 0 a 100
const PAGES = [
  [[47, 24], [47, 80], [12, 70], [12, 18]],
  [[53, 24], [88, 18], [88, 70], [53, 80]],
];

const inside = (poly, x, y) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};

/** Livro de largura `fraction` do lado, centrado; fundo opaco (`bg`) ou transparente (null). */
function render(size, { bg, fg, fraction }) {
  const SS = 4;
  const px = Buffer.alloc(size * size * 4);
  const offset = (100 - fraction * 100) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let hit = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          // gx/gy em coordenadas da grade do livro (100 = caixa inteira)
          const gx = ((x + (sx + 0.5) / SS) * 100) / size;
          const gy = ((y + (sy + 0.5) / SS) * 100) / size;
          const bx = (gx - offset) / fraction;
          const by = (gy - offset) / fraction;
          if (PAGES.some((p) => inside(p, bx, by))) hit++;
        }
      }
      const a = hit / (SS * SS);
      const i = (y * size + x) * 4;
      if (bg) {
        for (let k = 0; k < 3; k++) px[i + k] = Math.round(fg[k] * a + bg[k] * (1 - a));
        px[i + 3] = 255;
      } else {
        px[i] = fg[0];
        px[i + 1] = fg[1];
        px[i + 2] = fg[2];
        px[i + 3] = Math.round(a * 255);
      }
    }
  }
  return px;
}

function solid(size, color) {
  const px = Buffer.alloc(size * size * 4);
  for (let i = 0; i < px.length; i += 4) {
    px[i] = color[0];
    px[i + 1] = color[1];
    px[i + 2] = color[2];
    px[i + 3] = 255;
  }
  return px;
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

function png(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const write = (name, size, rgba) => fs.writeFileSync(new URL(name, OUT), png(size, rgba));

write('icon.png', 1024, render(1024, { bg: ACCENT, fg: WHITE, fraction: 0.7 }));
write('android-icon-background.png', 1024, solid(1024, ACCENT));
write('android-icon-foreground.png', 1024, render(1024, { bg: null, fg: WHITE, fraction: 0.55 }));
write('android-icon-monochrome.png', 1024, render(1024, { bg: null, fg: WHITE, fraction: 0.55 }));
write('splash-icon.png', 512, render(512, { bg: null, fg: ACCENT, fraction: 1 }));
console.log('Ícones gerados em assets/images/');
