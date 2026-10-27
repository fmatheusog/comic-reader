export type SeriesGuess = { series: string; number: number | null };

const KEYWORD = String.raw`(?:chapter|ch|cap[ií]tulo|cap|c|volume|vol|v|#)`;
// "Série - Chapter 12", "Série cap. 12 - Título", "Série v03", "Série #7"
const WITH_KEYWORD = new RegExp(String.raw`^(.+?)[\s._-]+${KEYWORD}\.?\s*0*(\d+(?:\.\d+)?)(?:[\s._-].*)?$`, 'i');
// "Série - 042" (só com traço ou underline, para não confundir "Fahrenheit 451" com capítulo)
const DASH_NUMBER = /^(.+?)\s*[-_]\s*0*(\d+(?:\.\d+)?)$/;

/** Limpa o nome de uma série: tira sublinhados, espaços repetidos e sobras nas pontas. */
export function cleanSeriesName(raw: string): string {
  return raw
    .replace(/_+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.-]+|[\s.-]+$/g, '')
    .trim();
}

/** Chave para agrupar séries sem diferenciar maiúsculas ou espaços. */
export const seriesKey = (name: string) => cleanSeriesName(name).toLowerCase();

/**
 * Tenta descobrir série e número do capítulo pelo nome do arquivo (com ou sem extensão).
 * Devolve null quando o nome não parece um capítulo de uma série.
 */
export function guessSeries(fileName: string): SeriesGuess | null {
  const base = fileName
    .replace(/\.(cbz|epub|pdf)$/i, '')
    .replace(/\[[^\]]*\]|\([^)]*\)/g, ' ') // [Grupo], (Digital)
    .replace(/\s+/g, ' ')
    .trim();
  const m = WITH_KEYWORD.exec(base) ?? DASH_NUMBER.exec(base);
  if (!m) return null;
  const series = cleanSeriesName(m[1]);
  if (!series) return null;
  return { series, number: Number(m[2]) };
}

const NUMBER = String.raw`0*(\d+(?:\.\d+)?)`;
const NUMBER_PATTERNS = [
  new RegExp(String.raw`(?:^|[\s._-])${KEYWORD}\.?\s*${NUMBER}(?:[\s._-]|$)`, 'i'), // "Chapter 5", "… - Cap 5 - …"
  new RegExp(String.raw`^${NUMBER}(?:[\s._-].*)?$`), // "012", "012 - Título"
  new RegExp(String.raw`[\s._-]${NUMBER}$`), // "Título 12"
];

/** Número do capítulo quando a obra já é conhecida (por exemplo, pelo nome da pasta). */
export function guessChapterNumber(fileName: string): number | null {
  const base = fileName
    .replace(/\.(cbz|epub|pdf)$/i, '')
    .replace(/\[[^\]]*\]|\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  for (const re of NUMBER_PATTERNS) {
    const m = re.exec(base);
    if (m) return Number(m[1]);
  }
  return null;
}

/** Lê o número digitado (aceita vírgula decimal); vazio ou inválido vira null. */
export function parseChapterNumber(text: string): number | null {
  const clean = text.trim().replace(',', '.');
  if (!clean) return null;
  const n = Number(clean);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export type InfoError = 'title' | 'number' | null;

/** Título é obrigatório; informando a obra, o número do capítulo também. Sem obra, é livro avulso. */
export function validateInfo(info: { title: string; series: string; number: string }): InfoError {
  if (!info.title.trim()) return 'title';
  if (info.series.trim() && parseChapterNumber(info.number) == null) return 'number';
  return null;
}
