import assert from 'node:assert/strict';
import { test } from 'node:test';

import JSZip from 'jszip';

import { buildEpub } from '../scripts/epub-builder.mjs';
import {
  parseContainer,
  parseNav,
  parseNcx,
  parseOpf,
  resolvePath,
  sanitizeChapter,
  splitChapter,
} from '../src/entities/book/formats/epubParse.ts';
import { buildChapterHtml, makeNonce, readerCss } from '../src/entities/book/formats/epubHtml.ts';
import { locate, overallProgress } from '../src/entities/book/formats/epubProgress.ts';

const png = Buffer.from('89504e470d0a1a0a', 'hex');

async function open(variant: 'epub3' | 'epub2') {
  const zip = await JSZip.loadAsync(await buildEpub(png, variant));
  const read = (p: string) => zip.file(p)!.async('string');
  const opfPath = parseContainer(await read('META-INF/container.xml'));
  const pkg = parseOpf(await read(opfPath), opfPath);
  return { zip, read, opfPath, pkg };
}

test('resolvePath normaliza .. e decodifica %xx', () => {
  assert.equal(resolvePath('OEBPS/texto', '../img/a%20b.png#x'), 'OEBPS/img/a b.png');
  assert.equal(resolvePath('', 'a/./b.xhtml'), 'a/b.xhtml');
});

test('EPUB 3: OPF, spine, capa e sumário (nav) com aninhamento', async () => {
  const { read, opfPath, pkg } = await open('epub3');
  assert.equal(opfPath, 'OEBPS/conteúdo/livro.opf');
  assert.equal(pkg.title, 'Livro de Exemplo');
  assert.equal(pkg.author, 'Autora Teste');
  assert.deepEqual(pkg.spine, [1, 2, 3].map((n) => `OEBPS/conteúdo/texto/cap${n}.xhtml`));
  assert.equal(pkg.coverPath, 'OEBPS/conteúdo/img/capa.png');
  assert.equal(pkg.tocKind, 'nav');
  const toc = parseNav(await read(pkg.tocPath!), pkg.tocPath!);
  assert.deepEqual(toc.map((e) => [e.title, e.depth]), [['Primeiro', 0], ['Subseção', 1], ['Segundo', 0], ['Terceiro', 0]]);
  assert.equal(toc[1].href, 'OEBPS/conteúdo/texto/cap1.xhtml#inicio');
});

test('EPUB 2: capa por meta e sumário NCX', async () => {
  const { read, pkg } = await open('epub2');
  assert.equal(pkg.coverPath, 'OEBPS/conteúdo/img/capa.png');
  assert.equal(pkg.tocKind, 'ncx');
  const toc = parseNcx(await read(pkg.tocPath!), pkg.tocPath!);
  assert.deepEqual(toc.map((e) => e.title), ['Capítulo 1', 'Capítulo 2', 'Capítulo 3']);
});

test('sanitizeChapter remove scripts e handlers; splitChapter mantém CSS e corpo', async () => {
  const { read, pkg } = await open('epub3');
  const raw = await read(pkg.spine[0]);
  const clean = sanitizeChapter(raw);
  assert.ok(!/<script/i.test(clean));
  assert.ok(!/onclick/i.test(clean));
  const { head, body } = splitChapter(clean);
  assert.match(head, /estilo\.css/);
  assert.match(body, /Capítulo 1/);
  assert.ok(!/<body/i.test(body));
});

test('progresso ponderado pelo tamanho dos capítulos e operação inversa', () => {
  const sizes = [100, 900, 0]; // o último vale 1 (mínimo)
  assert.equal(overallProgress(sizes, 0, 0), 0);
  assert.ok(Math.abs(overallProgress(sizes, 0, 1) - 100 / 1001) < 1e-9);
  assert.ok(Math.abs(overallProgress(sizes, 1, 0.5) - 550 / 1001) < 1e-9);
  assert.equal(overallProgress(sizes, 2, 1), 1);
  assert.equal(overallProgress([], 0, 0), 0);
  // locate é a inversa de overallProgress
  const there = locate(sizes, 550 / 1001);
  assert.equal(there.chapter, 1);
  assert.ok(Math.abs(there.ratio - 0.5) < 1e-9);
  assert.deepEqual(locate(sizes, 0), { chapter: 0, ratio: 0 });
  assert.equal(locate(sizes, 1).chapter, 2);
  assert.deepEqual(locate([], 0.5), { chapter: 0, ratio: 0 });
});

test('capítulo carrega com CSP: só o script do leitor (nonce), sem rede', () => {
  const settings = { fontFamily: 'serif', fontSize: 18, lineHeight: 1.6, margin: 20, textAlign: 'original' } as never;
  const theme = { background: '#fff', text: '#000', accent: '#00f' } as never;
  const css = readerCss(settings, theme);
  const html = buildChapterHtml({ baseUrl: 'file:///x/', head: '', body: '<p>oi</p>' }, css, 'abc123');
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /script-src 'nonce-abc123'/);
  assert.match(html, /<script nonce="abc123">/);
  assert.match(html, /default-src 'none'/);
  assert.match(html, /connect-src 'none'/);
  assert.ok(!/img-src[^;]*https?:/.test(html), 'imagens só locais');
  assert.ok(makeNonce().length >= 16 && makeNonce() !== makeNonce());
  assert.ok(!/text-align/.test(css), 'alinhamento original não força nada');
  assert.match(readerCss({ ...settings, textAlign: 'justify' }, theme), /text-align: justify !important/);
});
