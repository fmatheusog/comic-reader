import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Book } from '@/entities/book/db';
import { t } from '@/shared/i18n/pt';
import { resolveUri } from '@/entities/book/storage';
import { useAppTheme } from '@/shared/theme';

type Props = {
  book: Book;
  width: number;
  onPress: () => void;
  onLongPress: () => void;
};

export function BookCard({ book, width, onPress, onLongPress }: Props) {
  const theme = useAppTheme();
  const height = Math.round(width * 1.45);
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={`${book.title}, ${t.formats[book.format]}, ${t.percentRead(book.progress)}`}
      accessibilityHint="Toque para abrir. Toque e segure para mais ações."
      style={{ width }}>
      <View style={[styles.cover, { width, height, backgroundColor: theme.surface, borderColor: theme.border }]}>
        {book.coverPath ? (
          <Image source={{ uri: resolveUri(book.coverPath) }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <View style={styles.placeholder}>
            <Text style={[styles.placeholderText, { color: theme.textMuted }]} numberOfLines={5}>
              {book.title}
            </Text>
          </View>
        )}
        <View style={[styles.badge, { backgroundColor: theme.background }]}>
          <Text style={[styles.badgeText, { color: theme.text }]}>{t.formats[book.format]}</Text>
        </View>
        {book.progress > 0 && (
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${book.progress * 100}%`, backgroundColor: theme.accent }]} />
          </View>
        )}
      </View>
      <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>
        {book.title}
      </Text>
      {book.author ? (
        <Text style={[styles.author, { color: theme.textMuted }]} numberOfLines={1}>
          {book.author}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cover: { borderRadius: 8, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  placeholder: { flex: 1, padding: 10, justifyContent: 'center' },
  placeholderText: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  badge: { position: 'absolute', top: 6, left: 6, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, opacity: 0.9 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  barTrack: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 4, backgroundColor: 'rgba(0,0,0,0.25)' },
  barFill: { height: 4 },
  title: { marginTop: 6, fontSize: 13, fontWeight: '600' },
  author: { fontSize: 12 },
});
