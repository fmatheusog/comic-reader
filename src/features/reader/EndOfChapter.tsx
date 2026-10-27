import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getNextChapter, setFinished, type Book } from '@/entities/book/db';
import { t } from '@/shared/i18n/pt';

/** O próximo capítulo da mesma obra (null se for o último ou um livro avulso; undefined enquanto carrega). */
export function useNextChapter(book: Book): Book | null | undefined {
  const [next, setNext] = useState<Book | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    getNextChapter(book.id, book.series).then((n) => {
      if (alive) setNext(n);
    });
    return () => {
      alive = false;
    };
  }, [book.id, book.series]);
  return next;
}

type Props = {
  book: Book;
  /** Fechar o aviso e continuar no capítulo atual */
  onStay: () => void;
};

/**
 * Tela do fim do capítulo: oferece abrir o próximo (com confirmação, para não pular capítulo
 * por um toque a mais) ou voltar. Ao escolher qualquer uma das duas, o capítulo conta como lido.
 */
export function EndOfChapter({ book, onStay }: Props) {
  const insets = useSafeAreaInsets();
  const next = useNextChapter(book);
  const [busy, setBusy] = useState(false);

  const leave = async (to: () => void) => {
    if (busy) return;
    setBusy(true);
    await setFinished(book.id, true);
    to();
  };

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <Text style={styles.title} accessibilityRole="header">
        {next === null ? (book.series ? t.endOfSeries : t.endOfBook) : t.endOfChapter}
      </Text>
      <Text style={styles.current} numberOfLines={2}>
        {book.title}
      </Text>

      {next ? (
        <>
          <Text style={styles.label}>{t.nextUp}</Text>
          <Text style={styles.next} numberOfLines={3}>
            {next.title}
          </Text>
          <Pressable
            onPress={() => leave(() => router.replace(`/reader/${next.id}`))}
            accessibilityRole="button"
            style={[styles.primary, busy && styles.disabled]}>
            <Text style={styles.primaryText}>{t.nextChapter}</Text>
          </Pressable>
        </>
      ) : null}

      <Pressable onPress={() => leave(() => router.back())} accessibilityRole="button" style={styles.secondary}>
        <Text style={styles.secondaryText}>{book.series ? t.backToWork : t.back}</Text>
      </Pressable>
      <Pressable onPress={onStay} accessibilityRole="button" style={styles.secondary}>
        <Text style={styles.secondaryText}>{t.stayHere}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 12 },
  title: { color: '#fff', fontSize: 22, fontWeight: '700', textAlign: 'center' },
  current: { color: 'rgba(255,255,255,0.65)', textAlign: 'center' },
  label: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 12 },
  next: { color: '#fff', fontSize: 18, fontWeight: '600', textAlign: 'center' },
  primary: { minHeight: 52, minWidth: 240, borderRadius: 26, backgroundColor: '#8AB4F8', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, marginTop: 8 },
  primaryText: { color: '#0B1220', fontWeight: '700', fontSize: 16 },
  disabled: { opacity: 0.5 },
  secondary: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 16 },
  secondaryText: { color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
});
