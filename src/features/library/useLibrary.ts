import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { groupBySeries, type LibraryItem } from '@/entities/book/group';
import { listBooks, listContinueReading, type Book, type Filter, type SortKey } from '@/entities/book/db';

export function useLibrary(search: string, filter: Filter, sort: SortKey) {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [continueList, setContinueList] = useState<Book[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const [all, cont] = await Promise.all([listBooks({ search, filter, sort }), listContinueReading()]);
    setItems(groupBySeries(all));
    setContinueList(cont);
    setLoaded(true);
  }, [search, filter, sort]);


  // ao voltar do leitor o progresso mudou
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  return { items, continueList, loaded, refresh };
}
