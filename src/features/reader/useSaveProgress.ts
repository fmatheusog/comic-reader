import { useEffect, useRef } from 'react';

import { saveProgress } from '@/entities/book/db';

/** Grava o progresso 500 ms depois da última mudança e também ao sair do leitor. */
export function useSaveProgress(bookId: string, progress: number, position: unknown, enabled = true) {
  const latest = useRef({ progress, position });
  useEffect(() => {
    latest.current = { progress, position };
  });

  useEffect(() => {
    if (!enabled) return;
    const timer = setTimeout(() => {
      saveProgress(bookId, latest.current.progress, JSON.stringify(latest.current.position));
    }, 500);
    return () => clearTimeout(timer);
  }, [bookId, progress, position, enabled]);

  useEffect(
    () => () => {
      if (enabled) saveProgress(bookId, latest.current.progress, JSON.stringify(latest.current.position));
    },
    [bookId, enabled],
  );
}

export function parsePosition<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
