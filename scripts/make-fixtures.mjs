// Gera arquivos de exemplo (sem direitos autorais) em ./fixtures: um CBZ, um PDF e, se existir, um EPUB.
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

import JSZip from 'jszip';

const out = new URL('../fixtures/', import.meta.url);
mkdirSync(out, { recursive: true });

// --- PNG simples: fundo colorido com um número grande desenhado em blocos 5x7 ---
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
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
const FONT = {
  0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111',
  4: '101101111001001', 5: '111100111001111', 6: '111100111101111', 7: '111001001001001',
  8: '111101111101111', 9: '111101111001111',
};
function png(w, h, bg, label) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  const digits = String(label).split('');
  const cell = Math.floor(w / (digits.length * 4 + 1));
  const x0 = Math.floor((w - digits.length * 4 * cell) / 2);
  const y0 = Math.floor((h - 5 * cell) / 2);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      let on = false;
      const gy = Math.floor((y - y0) / cell);
      const gx = Math.floor((x - x0) / cell);
      if (gy >= 0 && gy < 5 && gx >= 0 && gx < digits.length * 4 && gx % 4 !== 3) {
        on = FONT[digits[Math.floor(gx / 4)]][gy * 3 + (gx % 4)] === '1';
      }
      const px = y * (w * 3 + 1) + 1 + x * 3;
      const c = on ? [255, 255, 255] : bg;
      raw[px] = c[0]; raw[px + 1] = c[1]; raw[px + 2] = c[2];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- CBZ: 12 páginas fora de ordem alfabética (p1, p2, p10...) para testar a ordenação natural ---
const cbz = new JSZip();
const palette = [[200, 60, 60], [60, 140, 200], [60, 170, 90], [200, 150, 40]];
for (let i = 1; i <= 12; i++) cbz.file(`pagina${i}.png`, png(600, 900, palette[i % 4], i));
cbz.file('ComicInfo.xml',
  '<?xml version="1.0"?><ComicInfo><Series>Exemplo</Series><Title>Capítulo 1</Title><Writer>Autor Teste</Writer><Manga>YesAndRightToLeft</Manga></ComicInfo>');
writeFileSync(new URL('exemplo.cbz', out), await cbz.generateAsync({ type: 'nodebuffer' }));

// --- PDF mínimo de 3 páginas ---
const pdfObjs = [];
const add = (s) => pdfObjs.push(s) && pdfObjs.length;
add('<< /Type /Catalog /Pages 2 0 R >>');
add('<< /Type /Pages /Kids [3 0 R 5 0 R 7 0 R] /Count 3 >>');
for (let p = 1; p <= 3; p++) {
  const stream = `BT /F1 48 Tf 100 700 Td (Pagina ${p} de teste) Tj ET`;
  add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${3 + p * 2 - 1 + 0} 0 R /Resources << /Font << /F1 9 0 R >> >> >>`);
  add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
}
add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
let pdf = '%PDF-1.4\n';
const offsets = [];
pdfObjs.forEach((o, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
const xref = pdf.length;
pdf += `xref\n0 ${pdfObjs.length + 1}\n0000000000 65535 f \n` + offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
pdf += `trailer\n<< /Size ${pdfObjs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
writeFileSync(new URL('exemplo.pdf', out), pdf, 'latin1');

console.log('Fixtures geradas em fixtures/');
