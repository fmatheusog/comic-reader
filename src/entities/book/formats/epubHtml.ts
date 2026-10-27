import type { Settings } from '@/shared/settings/store';
import type { Theme } from '@/shared/theme';

import type { ChapterContent } from './epub';

export const EPUB_FONTS = {
  serif: 'Georgia, "Noto Serif", serif',
  sans: '"Roboto", "Noto Sans", sans-serif',
};

/** CSS do usuário. Usa !important para vencer o CSS embutido do livro. */
export function readerCss(s: Settings, theme: Theme): string {
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
`;
}

/** Script do leitor: posição de rolagem, restauração, toques por zona e links. Roda depois de o conteúdo ser sanitizado. */
const READER_JS = `
(function () {
  var post = function (m) { window.ReactNativeWebView.postMessage(JSON.stringify(m)); };
  var maxScroll = function () { return Math.max(0, document.documentElement.scrollHeight - window.innerHeight); };
  var ratio = function () { var m = maxScroll(); return m ? window.scrollY / m : 1; };
  var timer;
  window.addEventListener('scroll', function () {
    clearTimeout(timer);
    timer = setTimeout(function () { post({ type: 'scroll', ratio: ratio() }); }, 150);
  }, { passive: true });

  window.__setCss = function (css) { document.getElementById('user-css').textContent = css; };
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

export function buildChapterHtml(c: ChapterContent, css: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<base href="${c.baseUrl}">
${c.head}
<style id="user-css">${css}</style>
</head><body>${c.body}<script>${READER_JS}</script></body></html>`;
}
