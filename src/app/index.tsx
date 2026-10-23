import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/theme';

export default function LibraryScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, paddingTop: insets.top + 16, paddingHorizontal: 16 }}>
      <Text style={{ color: theme.text, fontSize: 28, fontWeight: '700' }}>Biblioteca</Text>
    </View>
  );
}
