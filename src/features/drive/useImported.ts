import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { listCoversBySource, listSourceIds } from '@/entities/book/db';

/** O que já foi importado do Drive: ids de origem e as capas desses livros. Atualiza ao voltar para a tela. */
export function useImported() {
  const [imported, setImported] = useState<Set<string>>(new Set());
  const [covers, setCovers] = useState<Map<string, string>>(new Map());

  const reload = useCallback(async () => {
    const [ids, coverMap] = await Promise.all([listSourceIds(), listCoversBySource()]);
    setImported(ids);
    setCovers(coverMap);
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  return { imported, covers, reload };
}
