import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { CompaniesProvider } from '@/src/context/CompaniesContext';
import { AuthProvider, useAuth } from '@/src/context/AuthContext';
import { ThemeProvider, useTheme } from '@/src/context/ThemeContext';

function RootStack() {
  const { colors, isDark } = useTheme();
  const { userId, loading } = useAuth();
  // 保存済みセッションの確認中はログイン画面を一瞬出さない
  if (loading) return null;
  const signedIn = userId !== null;
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Protected guard={signedIn}>
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
          <Stack.Screen name="conflicts" />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="login" />
        </Stack.Protected>
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <CompaniesProvider>
          <RootStack />
        </CompaniesProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
