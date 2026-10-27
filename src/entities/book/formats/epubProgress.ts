// Progresso de leitura do EPUB ponderado pelo tamanho dos capítulos (sem imports de runtime).

const weights = (sizes: number[]) => sizes.map((s) => Math.max(1, s));

/** Fração lida do livro (0 a 1), dado o capítulo atual e a posição de rolagem dentro dele. */
export function overallProgress(sizes: number[], chapter: number, ratio: number): number {
  if (sizes.length === 0) return 0;
  const w = weights(sizes);
  const total = w.reduce((a, b) => a + b, 0);
  const i = Math.min(Math.max(chapter, 0), w.length - 1);
  const before = w.slice(0, i).reduce((a, b) => a + b, 0);
  return Math.min(1, Math.max(0, (before + w[i] * Math.min(1, Math.max(0, ratio))) / total));
}

/** Operação inversa: capítulo e posição dentro dele para uma fração do livro. */
export function locate(sizes: number[], fraction: number): { chapter: number; ratio: number } {
  if (sizes.length === 0) return { chapter: 0, ratio: 0 };
  const w = weights(sizes);
  const total = w.reduce((a, b) => a + b, 0);
  const target = Math.min(1, Math.max(0, fraction)) * total;
  let acc = 0;
  for (let i = 0; i < w.length; i++) {
    if (target <= acc + w[i] || i === w.length - 1) {
      return { chapter: i, ratio: Math.min(1, Math.max(0, (target - acc) / w[i])) };
    }
    acc += w[i];
  }
  return { chapter: w.length - 1, ratio: 1 };
}
