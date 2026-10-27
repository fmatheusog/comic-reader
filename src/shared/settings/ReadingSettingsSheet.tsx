import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/shared/i18n/pt';
import { updateSettings, useSettings, type Settings, type ThemePref } from '@/shared/settings/store';
import { useAppTheme } from '@/shared/theme';

const THEMES: ThemePref[] = ['system', 'light', 'sepia', 'dark'];

function Stepper({
  label,
  value,
  onMinus,
  onPlus,
}: {
  label: string;
  value: string;
  onMinus: () => void;
  onPlus: () => void;
}) {
  const theme = useAppTheme();
  const btn = (text: string, onPress: () => void, a11y: string) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={[styles.stepBtn, { backgroundColor: theme.background, borderColor: theme.border }]}>
      <Text style={{ color: theme.text, fontSize: 20, fontWeight: '700' }}>{text}</Text>
    </Pressable>
  );
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: theme.text }]}>{label}</Text>
      <View style={styles.stepper}>
        {btn('−', onMinus, `${t.decrease} ${label}`)}
        <Text style={[styles.value, { color: theme.text }]}>{value}</Text>
        {btn('+', onPlus, `${t.increase} ${label}`)}
      </View>
    </View>
  );
}

export function ChipRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const theme = useAppTheme();
  return (
    <View style={styles.chips}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[
              styles.chip,
              { backgroundColor: active ? theme.accent : theme.background, borderColor: theme.border },
            ]}>
            <Text style={{ color: active ? theme.background : theme.text, fontWeight: '600' }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export const themeOptions = THEMES.map((v) => ({ value: v, label: t.themes[v] }));

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Controles de tema, fonte, tamanho, espaçamento e margem do texto (EPUB). */
export function TextSettingsControls() {
  const s = useSettings();
  const set = (p: Partial<Settings>) => updateSettings(p);
  return (
    <>
      <Text style={styles.sectionLabel}>{t.theme}</Text>
      <ChipRow options={themeOptions} value={s.theme} onChange={(v) => set({ theme: v })} />
      <Text style={styles.sectionLabel}>{t.font}</Text>
      <ChipRow
        options={[
          { value: 'serif', label: t.serif },
          { value: 'sans', label: t.sans },
        ]}
        value={s.fontFamily}
        onChange={(v) => set({ fontFamily: v })}
      />
      <Stepper
        label={t.fontSize}
        value={`${s.fontSize}`}
        onMinus={() => set({ fontSize: Math.max(12, s.fontSize - 1) })}
        onPlus={() => set({ fontSize: Math.min(32, s.fontSize + 1) })}
      />
      <Stepper
        label={t.lineSpacing}
        value={s.lineHeight.toFixed(1)}
        onMinus={() => set({ lineHeight: Math.max(1.2, round1(s.lineHeight - 0.1)) })}
        onPlus={() => set({ lineHeight: Math.min(2.2, round1(s.lineHeight + 0.1)) })}
      />
      <Stepper
        label={t.margins}
        value={`${s.margin}`}
        onMinus={() => set({ margin: Math.max(0, s.margin - 4) })}
        onPlus={() => set({ margin: Math.min(64, s.margin + 4) })}
      />
    </>
  );
}

export function ReadingSettingsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t.close} />
      <View
        style={[
          styles.sheet,
          { backgroundColor: theme.surface, borderColor: theme.border, paddingBottom: insets.bottom + 12 },
        ]}>
        <ScrollView>
          <TextSettingsControls />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  sheet: {
    position: 'absolute',
    bottom: 0,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 560,
    maxHeight: '70%',
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sectionLabel: { fontSize: 12, fontWeight: '700', opacity: 0.6, marginTop: 8, marginBottom: 6, color: '#888' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  rowLabel: { fontSize: 15 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  value: { minWidth: 44, textAlign: 'center', fontSize: 15, fontVariant: ['tabular-nums'] },
});
