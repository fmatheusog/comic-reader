import type { Settings } from '@/shared/settings/store';
import type { Theme } from '@/shared/theme';

import type { ChapterContent } from './epub';

export const EPUB_FONTS = {
  serif: 'Georgia, "Noto Serif", serif',
  sans: '"Roboto", "Noto Sans", sans-serif',
};

/** CSS do usuário. Usa !important para vencer o CSS embutido do livro. */
export function readerCss(s: Settings, theme: Theme): string {
  const align = s.textAlign === 'original' ? '' : `p, li, blockquote, dd { text-align: ${s.textAlign} !important; }`;
  return `
html, body { background: ${theme.background} !important; color: ${theme.text} !important; }
body {
  margin: 0 !important; padding: 16px ${s.margin}px 96px !important;
  font-family: ${EPUB_FONTS[s.fontFamily]} !important;
  font-size: ${s.fontSize}px !important; line-height: ${s.lineHeight} !important;
  -webkit-text-size-adjust: 100%; overflow-wrap: break-word; hyphens: auto;
}
body *:not(img):not(svg):not(image) { color: inherit !important; background-color: transparent !important; font-family: inherit !important; line-height: inherit !important; }
p, li, blockquote, div { font-size: inherit !important; }
h1, h2, h3, h4 { line-height: 1.25 !important; }
a { color: ${theme.accent} !important; }
img, svg, video { max-width: 100% !important; height: auto !important; }
${align}
`;
}

/** Script do leitor: posição de rolagem, restauração, toques por zona e links. Roda depois de o conteúdo ser sanitizado. */
const READER_JS = `
(function () {
  var post = function (m) { window.ReactNativeWebView.postMessage(JSON.stringify(m)); };
  var maxScroll = function () { return Math.max(0, document.documentElement.scrollHeight - window.innerHeight); };
  var ratio = function () { var m = maxScroll(); return m ? window.scrollY / m : 1; };
  var timer, resizeTimer, lastRatio = 0;
  window.addEventListener('scroll', function () {
    lastRatio = ratio();
    clearTimeout(timer);
    timer = setTimeout(function () { post({ type: 'scroll', ratio: lastRatio }); }, 150);
  }, { passive: true });

  // mudar fonte/margem ou girar a tela refaz o texto; mantém o ponto de leitura pela fração rolada
  var keepPlace = function (r) { window.requestAnimationFrame(function () { window.scrollTo(0, r * maxScroll()); }); };
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { keepPlace(lastRatio); }, 120);
  });

  window.__setCss = function (css) {
    var r = ratio();
    document.getElementById('user-css').textContent = css;
    keepPlace(r);
  };
  window.__restore = function (r, anchor) {
    var el = anchor && document.getElementById(anchor);
    if (el) el.scrollIntoView(); else window.scrollTo(0, r * maxScroll());
  };
  window.__page = function (dir) {
    var m = maxScroll();
    if (dir > 0 && window.scrollY >= m - 4) return post({ type: 'edge', dir: 1 });
    if (dir < 0 && window.scrollY <= 4) return post({ type: 'edge', dir: -1 });
    window.scrollBy({ top: dir * window.innerHeight * 0.88, behavior: 'smooth' });
  };

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (a) {
      e.preventDefault();
      post({ type: 'link', href: a.getAttribute('href') });
      return;
    }
    var f = e.clientX / window.innerWidth;
    post({ type: 'tap', zone: f < 0.3 ? 'left' : f > 0.7 ? 'right' : 'center' });
  }, true);

  function ready() {
    var imgs = Array.prototype.slice.call(document.images).filter(function (i) { return !i.complete; });
    Promise.all(imgs.map(function (i) { return new Promise(function (r) { i.onload = i.onerror = r; }); }))
      .then(function () { post({ type: 'ready' }); });
  }
  if (document.readyState === 'complete') ready(); else window.addEventListener('load', ready);
})();
`;

/** Código aleatório de uso único por capítulo: só o script do leitor o conhece. */
export function makeNonce(): string {
  let out = '';
  for (let i = 0; i < 4; i++) out += Math.random().toString(36).slice(2, 10);
  return out;
}

/**
 * Política de segurança do capítulo (segunda barreira, além da sanitização por regex):
 * só o script do leitor roda (pelo nonce), nada acessa a rede e só carregam arquivos locais.
 */
export function contentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'none'",
    'img-src file: data:',
    "style-src file: 'unsafe-inline'",
    'font-src file: data:',
    'media-src file: data:',
    `script-src 'nonce-${nonce}'`,
    'base-uri file:',
    "form-action 'none'",
    "frame-src 'none'",
    "connect-src 'none'",
  ].join('; ');
}

export function buildChapterHtml(c: ChapterContent, css: string, nonce: string = makeNonce()): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy(nonce)}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<base href="${c.baseUrl}">
${c.head}
<style id="user-css">${css}</style>
</head><body>${c.body}<script nonce="${nonce}">${READER_JS}</script></body></html>`;
}
