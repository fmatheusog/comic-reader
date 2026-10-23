/**
 * Agrupa os índices das páginas em "folhas" de leitura.
 * Em modo duplo a capa fica sozinha e as demais vão em pares (1-2, 3-4...).
 */
export function buildSpreads(pageCount: number, dual: boolean): number[][] {
  const spreads: number[][] = [];
  if (!dual) {
    for (let i = 0; i < pageCount; i++) spreads.push([i]);
    return spreads;
  }
  if (pageCount > 0) spreads.push([0]);
  for (let i = 1; i < pageCount; i += 2) {
    spreads.push(i + 1 < pageCount ? [i, i + 1] : [i]);
  }
  return spreads;
}

export function spreadIndexOf(spreads: number[][], page: number): number {
  const idx = spreads.findIndex((s) => s.includes(page));
  return idx === -1 ? 0 : idx;
}
