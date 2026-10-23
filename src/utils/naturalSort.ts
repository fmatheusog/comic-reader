const chunk = /(\d+)/;

/** Ordenação natural: "p2.jpg" vem antes de "p10.jpg", sem diferenciar maiúsculas. */
export function naturalCompare(a: string, b: string): number {
  const pa = a.toLowerCase().split(chunk);
  const pb = b.toLowerCase().split(chunk);
  const n = Math.min(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    if (pa[i] === pb[i]) continue;
    if (i % 2 === 1) {
      const d = Number(pa[i]) - Number(pb[i]);
      if (d !== 0) return d;
    } else {
      return pa[i] < pb[i] ? -1 : 1;
    }
  }
  return pa.length - pb.length;
}

export const naturalSort = (items: string[]) => [...items].sort(naturalCompare);
