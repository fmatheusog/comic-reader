// Monta um EPUB mínimo de exemplo (texto original, sem direitos autorais).
import JSZip from 'jszip';

const chapter = (n, extra = '') => `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>Capítulo ${n}</title><link rel="stylesheet" type="text/css" href="../css/estilo.css"/>
<script>document.body.innerHTML = 'hackeado';</script></head>
<body>
<h1 id="inicio">Capítulo ${n}</h1>
${Array.from({ length: 30 }, (_, i) => `<p onclick="alert(1)">Parágrafo ${i + 1} do capítulo ${n}. Texto de exemplo para testar rolagem, tamanho de fonte e espaçamento entre linhas no leitor.</p>`).join('\n')}
${extra}
<p><a href="cap${n === 3 ? 1 : n + 1}.xhtml#inicio">Ir para o próximo</a></p>
</body></html>`;

/**
 * @param {Buffer} coverPng imagem de capa
 * @param {'epub3' | 'epub2'} variant epub3 usa nav + cover-image; epub2 usa NCX + meta cover
 */
export async function buildEpub(coverPng, variant = 'epub3') {
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file(
    'META-INF/container.xml',
    '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/conteúdo/livro.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
  );
  const base = 'OEBPS/conteúdo/';
  zip.file(`${base}css/estilo.css`, 'body { color: red; background: yellow; } img { max-width: 100%; }');
  zip.file(`${base}img/capa.png`, coverPng);
  for (let n = 1; n <= 3; n++) {
    zip.file(`${base}texto/cap${n}.xhtml`, chapter(n, n === 2 ? '<p><img src="../img/capa.png" alt="ilustração"/></p>' : ''));
  }
  const e3 = variant === 'epub3';
  zip.file(
    `${base}livro.opf`,
    `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="${e3 ? '3.0' : '2.0'}" unique-identifier="id">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
<dc:title>Livro de Exemplo</dc:title><dc:creator>Autora Teste</dc:creator><dc:identifier id="id">exemplo-1</dc:identifier>
${e3 ? '' : '<meta name="cover" content="capa"/>'}
</metadata>
<manifest>
<item id="capa" href="img/capa.png" media-type="image/png"${e3 ? ' properties="cover-image"' : ''}/>
<item id="css" href="css/estilo.css" media-type="text/css"/>
${e3 ? '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>' : '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>'}
${[1, 2, 3].map((n) => `<item id="c${n}" href="texto/cap${n}.xhtml" media-type="application/xhtml+xml"/>`).join('\n')}
</manifest>
<spine${e3 ? '' : ' toc="ncx"'}>${[1, 2, 3].map((n) => `<itemref idref="c${n}"/>`).join('')}</spine>
</package>`,
  );
  if (e3) {
    zip.file(
      `${base}nav.xhtml`,
      `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Sumário</title></head><body>
<nav epub:type="toc"><ol>
<li><a href="texto/cap1.xhtml">Primeiro</a><ol><li><a href="texto/cap1.xhtml#inicio">Subseção</a></li></ol></li>
<li><a href="texto/cap2.xhtml">Segundo</a></li>
<li><a href="texto/cap3.xhtml">Terceiro</a></li>
</ol></nav></body></html>`,
    );
  } else {
    zip.file(
      `${base}toc.ncx`,
      `<?xml version="1.0"?><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><navMap>
${[1, 2, 3].map((n) => `<navPoint id="n${n}" playOrder="${n}"><navLabel><text>Capítulo ${n}</text></navLabel><content src="texto/cap${n}.xhtml"/></navPoint>`).join('\n')}
</navMap></ncx>`,
    );
  }
  return zip.generateAsync({ type: 'nodebuffer', mimeType: 'application/epub+zip' });
}
