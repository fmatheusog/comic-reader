import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { SeriesGroup } from '@/entities/book/group';
import { resolveUri } from '@/entities/book/storage';
import { t } from '@/shared/i18n/pt';
import { useAppTheme } from '@/shared/theme';

type Props = { group: SeriesGroup; width: number; onPress: () => void; onLongPress: () => void };

export function SeriesCard({ group, width, onPress, onLongPress }: Props) {
  const theme = useAppTheme();
  const height = Math.round(width * 1.45);
  const cover = group.books.find((b) => b.coverPath)?.coverPath;
  const progress = group.books.reduce((sum, b) => sum + (b.finished ? 1 : b.progress), 0) / group.books.length;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={`${group.name}, ${t.chapters(group.books.length)}`}
      accessibilityHint="Toque para ver os capítulos. Toque e segure para mais ações."
      style={{ width }}>
      <View style={[styles.cover, { width, height, backgroundColor: theme.surface, borderColor: theme.border }]}>
        {cover ? (
          <Image source={{ uri: resolveUri(cover) }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <View style={styles.placeholder}>
            <Text style={[styles.placeholderText, { color: theme.textMuted }]} numberOfLines={5}>
              {group.name}
            </Text>
          </View>
        )}
        <View style={[styles.badge, { backgroundColor: theme.accent }]}>
          <Text style={[styles.badgeText, { color: theme.background }]}>{group.books.length}</Text>
        </View>
        {progress > 0 && (
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${progress * 100}%`, backgroundColor: theme.accent }]} />
          </View>
        )}
      </View>
      <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>
        {group.name}
      </Text>
      <Text style={[styles.sub, { color: theme.textMuted }]} numberOfLines={1}>
        {t.chapters(group.books.length)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cover: { borderRadius: 8, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  placeholder: { flex: 1, padding: 10, justifyContent: 'center' },
  placeholderText: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  badge: { position: 'absolute', top: 6, right: 6, minWidth: 22, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 11, alignItems: 'center' },
  badgeText: { fontSize: 11, fontWeight: '700' },
  barTrack: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 4, backgroundColor: 'rgba(0,0,0,0.25)' },
  barFill: { height: 4 },
  title: { marginTop: 6, fontSize: 13, fontWeight: '600' },
  sub: { fontSize: 12 },
});
