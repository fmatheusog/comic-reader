import { XMLParser } from 'fast-xml-parser';

export type ComicInfo = {
  title?: string;
  series?: string;
  writer?: string;
  summary?: string;
  manga: boolean;
  /** Mangá lido da direita para a esquerda */
  rtl: boolean;
};

/** Lê o essencial de um ComicInfo.xml (padrão Anansi). */
export function parseComicInfo(xml: string): ComicInfo {
  const doc = new XMLParser({ ignoreAttributes: true }).parse(xml)?.ComicInfo ?? {};
  const str = (v: unknown) => (v == null || v === '' ? undefined : String(v));
  const manga = str(doc.Manga);
  return {
    title: str(doc.Title),
    series: str(doc.Series),
    writer: str(doc.Writer),
    summary: str(doc.Summary),
    manga: manga != null && manga !== 'No' && manga !== 'Unknown',
    rtl: manga === 'YesAndRightToLeft',
  };
}
