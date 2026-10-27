import { XMLParser } from 'fast-xml-parser';

/** Funções puras (sem dependências nativas) para ler o pacote EPUB: container, OPF, sumário e sanitização. */

export type TocEntry = { title: string; href: string; depth: number };

export type EpubPackage = {
  title: string | null;
  author: string | null;
  /** caminhos dos capítulos, relativos à raiz do EPUB, na ordem da spine */
  spine: string[];
  coverPath: string | null;
  tocPath: string | null;
  tocKind: 'nav' | 'ncx' | null;
};

const ARRAY_TAGS = new Set(['item', 'itemref', 'creator', 'li', 'ol', 'a', 'navPoint', 'nav', 'meta', 'title']);

const xml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  textNodeName: '#text',
  isArray: (name) => ARRAY_TAGS.has(name),
  processEntities: true,
});

/** Junta e normaliza caminhos no estilo POSIX, resolvendo `.` e `..` e decodificando %xx. */
export function resolvePath(baseDir: string, href: string): string {
  const clean = href.split('#')[0].split('?')[0];
  let decoded = clean;
  try {
    decoded = decodeURIComponent(clean);
  } catch {
    /* mantém como está */
  }
  const parts = (decoded.startsWith('/') ? decoded : `${baseDir}/${decoded}`).split('/');
  const out: string[] = [];
  for (const p of parts) {
    if (!p || p === '.') continue;
    if (p === '..') out.pop();
    else out.push(p);
  }
  return out.join('/');
}

export const dirOf = (path: string) => path.split('/').slice(0, -1).join('/');

const textOf = (node: unknown): string => {
  if (node == null) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (typeof node === 'object') {
    return Object.entries(node as Record<string, unknown>)
      .filter(([k]) => !k.startsWith('@_'))
      .map(([, v]) => textOf(v))
      .join('');
  }
  return '';
};

const squash = (s: string) => s.replace(/\s+/g, ' ').trim();

export function parseContainer(containerXml: string): string {
  const root = xml.parse(containerXml)?.container;
  const rf = root?.rootfiles?.rootfile;
  const first = Array.isArray(rf) ? rf[0] : rf;
  const path = first?.['@_full-path'];
  if (!path) throw new Error('container.xml sem rootfile');
  return String(path);
}

export function parseOpf(opfXml: string, opfPath: string): EpubPackage {
  const pkg = xml.parse(opfXml)?.package;
  if (!pkg) throw new Error('OPF inválido');
  const base = dirOf(opfPath);

  const items: Record<string, { href: string; type: string; props: string[] }> = {};
  for (const it of pkg.manifest?.item ?? []) {
    items[it['@_id']] = {
      href: resolvePath(base, String(it['@_href'])),
      type: it['@_media-type'] ?? '',
      props: String(it['@_properties'] ?? '').split(/\s+/).filter(Boolean),
    };
  }

  const spine: string[] = [];
  for (const ref of pkg.spine?.itemref ?? []) {
    if (ref['@_linear'] === 'no') continue;
    const it = items[ref['@_idref']];
    if (it) spine.push(it.href);
  }

  const md = pkg.metadata ?? {};
  const title = squash(textOf(md.title?.[0])) || null;
  const author = squash(textOf(md.creator?.[0])) || null;

  let coverPath: string | null = null;
  const withCoverProp = Object.values(items).find((i) => i.props.includes('cover-image'));
  if (withCoverProp) coverPath = withCoverProp.href;
  else {
    const coverMeta = (md.meta ?? []).find((m: Record<string, string>) => m['@_name'] === 'cover');
    const it = coverMeta && items[coverMeta['@_content']];
    if (it) coverPath = it.href;
  }

  let tocPath: string | null = null;
  let tocKind: EpubPackage['tocKind'] = null;
  const nav = Object.values(items).find((i) => i.props.includes('nav'));
  if (nav) {
    tocPath = nav.href;
    tocKind = 'nav';
  } else {
    const ncx = items[pkg.spine?.['@_toc']] ?? Object.values(items).find((i) => i.type === 'application/x-dtbncx+xml');
    if (ncx) {
      tocPath = ncx.href;
      tocKind = 'ncx';
    }
  }

  return { title, author, spine, coverPath, tocPath, tocKind };
}

/** Sumário EPUB 3 (`<nav epub:type="toc">`). */
export function parseNav(navXhtml: string, navPath: string): TocEntry[] {
  const doc = xml.parse(navXhtml);
  const body = doc?.html?.body;
  const navs: Record<string, unknown>[] = body?.nav ?? body?.section?.nav ?? [];
  const toc = navs.find((n) => String(n['@_type'] ?? '').includes('toc')) ?? navs[0];
  const base = dirOf(navPath);
  const out: TocEntry[] = [];

  const walkOl = (ol: Record<string, unknown>, depth: number) => {
    for (const li of (ol.li as Record<string, unknown>[] | undefined) ?? []) {
      const a = (li.a as Record<string, unknown>[] | undefined)?.[0];
      const label = squash(textOf(a ?? (li as { span?: unknown }).span));
      const href = a?.['@_href'];
      if (href && label) out.push({ title: label, href: resolveHref(base, String(href)), depth });
      for (const child of (li.ol as Record<string, unknown>[] | undefined) ?? []) walkOl(child, depth + 1);
    }
  };
  for (const ol of ((toc as Record<string, unknown> | undefined)?.ol as Record<string, unknown>[]) ?? []) walkOl(ol, 0);
  return out;
}

/** Sumário EPUB 2 (NCX). */
export function parseNcx(ncxXml: string, ncxPath: string): TocEntry[] {
  const navMap = xml.parse(ncxXml)?.ncx?.navMap;
  const base = dirOf(ncxPath);
  const out: TocEntry[] = [];
  const walk = (points: Record<string, unknown>[] | undefined, depth: number) => {
    for (const p of points ?? []) {
      const label = squash(textOf((p.navLabel as Record<string, unknown> | undefined)?.text));
      const src = (p.content as Record<string, unknown> | undefined)?.['@_src'];
      if (src && label) out.push({ title: label, href: resolveHref(base, String(src)), depth });
      walk(p.navPoint as Record<string, unknown>[] | undefined, depth + 1);
    }
  };
  walk(navMap?.navPoint, 0);
  return out;
}

/** Resolve um href mantendo o fragmento (#id). */
export function resolveHref(baseDir: string, href: string): string {
  const hash = href.includes('#') ? href.slice(href.indexOf('#')) : '';
  return resolvePath(baseDir, href) + hash;
}

/** Remove scripts, manipuladores de evento e URLs javascript: do capítulo. */
export function sanitizeChapter(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<script\b[^>]*\/>/gi, '')
    .replace(/<(iframe|object|embed)\b[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src|xlink:href)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '$1=$2#$2');
}

/** Conteúdo do <body> do capítulo e os <link>/<style> do <head> (para manter as imagens e o CSS da editora). */
export function splitChapter(html: string): { head: string; body: string } {
  const bodyMatch = html.match(/<body\b[^>]*>([\s\S]*?)<\/body\s*>/i);
  const headMatch = html.match(/<head\b[^>]*>([\s\S]*?)<\/head\s*>/i);
  const headParts = headMatch
    ? (headMatch[1].match(/<link\b[^>]*>|<style\b[\s\S]*?<\/style\s*>/gi) ?? []).join('\n')
    : '';
  return { head: headParts, body: bodyMatch ? bodyMatch[1] : html };
}
