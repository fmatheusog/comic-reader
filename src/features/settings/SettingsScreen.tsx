import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChipRow, TextSettingsControls } from '@/shared/settings/ReadingSettingsSheet';
import { t } from '@/shared/i18n/pt';
import { updateSettings, useSettings } from '@/shared/settings/store';
import { useAppTheme } from '@/shared/theme';

export default function SettingsScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const s = useSettings();
  return (
    <View style={{ flex: 1, paddingTop: insets.top + 8 }}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t.back} style={styles.back}>
          <Text style={{ color: theme.text, fontSize: 32 }}>‹</Text>
        </Pressable>
        <Text style={[styles.title, { color: theme.text }]} accessibilityRole="header">
          {t.settings}
        </Text>
      </View>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: Math.max(16, insets.left + 16, insets.right + 16),
          paddingBottom: insets.bottom + 24,
          maxWidth: 640,
          alignSelf: 'center',
          width: '100%',
        }}>
        <Text style={[styles.group, { color: theme.text }]}>{t.textGroup}</Text>
        <TextSettingsControls />
        <Text style={[styles.group, { color: theme.text }]}>{t.comicsGroup}</Text>
        <Text style={{ color: theme.textMuted, marginBottom: 6 }}>{t.twoPagesHint}</Text>
        <ChipRow
          options={[
            { value: 'on', label: t.on },
            { value: 'off', label: t.off },
          ]}
          value={s.dualPage ? 'on' : 'off'}
          onChange={(v) => updateSettings({ dualPage: v === 'on' })}
        />
        <Text style={{ color: theme.textMuted, marginTop: 16 }}>{t.mangaHint}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  back: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '700' },
  group: { fontSize: 18, fontWeight: '700', marginTop: 20, marginBottom: 4 },
});
