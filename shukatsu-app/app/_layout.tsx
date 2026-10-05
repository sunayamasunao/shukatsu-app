import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { CompaniesProvider } from '@/src/context/CompaniesContext';
import { ThemeProvider, useTheme } from '@/src/context/ThemeContext';

function RootStack() {
  const { colors, isDark } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="add"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen name="detail/[id]" />
        <Stack.Screen name="selection/[cid]/[sid]" />
        <Stack.Screen
          name="review/[cid]/[sid]"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <CompaniesProvider>
        <RootStack />
      </CompaniesProvider>
    </ThemeProvider>
  );
}
