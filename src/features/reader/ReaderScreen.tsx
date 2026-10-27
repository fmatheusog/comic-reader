import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { CbzReader } from '@/features/reader/CbzReader';
import { EpubReader } from '@/features/reader/EpubReader';
import { PdfReader } from '@/features/reader/PdfReader';
import { getBook, type Book } from '@/entities/book/db';
import { t } from '@/shared/i18n/pt';

export default function ReaderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [book, setBook] = useState<Book | null | undefined>(undefined);

  useEffect(() => {
    getBook(id).then(setBook);
  }, [id]);

  let content;
  if (book === undefined) content = <ActivityIndicator color="#fff" />;
  else if (book === null) content = <Text style={{ color: '#fff' }}>{t.notFound}</Text>;
  else if (book.format === 'cbz') return <CbzReader book={book} />;
  else if (book.format === 'pdf') return <PdfReader book={book} />;
  else return <EpubReader book={book} />;

  return (
    <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
      <Stack.Screen options={{ animation: 'fade' }} />
      {content}
    </View>
  );
}
