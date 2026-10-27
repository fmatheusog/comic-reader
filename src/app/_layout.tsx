import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { loadSettings } from '@/shared/settings/store';
import { useAppTheme } from '@/shared/theme';

export default function RootLayout() {
  const theme = useAppTheme();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadSettings()
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.background }}>
      <SafeAreaProvider>
        <StatusBar style={theme.statusBar} />
        {ready && (
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: theme.background },
            }}
          />
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
