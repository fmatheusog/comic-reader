import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { listBooks, listContinueReading, type Book, type Filter, type SortKey } from '@/db/books';

export function useLibrary(search: string, filter: Filter, sort: SortKey) {
  const [books, setBooks] = useState<Book[]>([]);
  const [continueList, setContinueList] = useState<Book[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const [all, cont] = await Promise.all([listBooks({ search, filter, sort }), listContinueReading()]);
    setBooks(all);
    setContinueList(cont);
    setLoaded(true);
  }, [search, filter, sort]);


  // ao voltar do leitor o progresso mudou
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  return { books, continueList, loaded, refresh };
}
