import React from 'react';
import { ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/context/ThemeContext';
import { FloatingTabBar } from '@/src/components/FloatingTabBar';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function tabIcon(name: IconName) {
  return ({ color, size }: { color: ColorValue; size: number; focused: boolean }) => (
    <Ionicons name={name} size={size} color={color as string} />
  );
}

export default function TabLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      // 画面下に浮かぶ角丸のタブバー（選択中のピルが滑らかに移動する）
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'ホーム', tabBarIcon: tabIcon('home') }} />
      <Tabs.Screen name="calendar" options={{ title: 'カレンダー', tabBarIcon: tabIcon('calendar') }} />
      <Tabs.Screen name="compare" options={{ title: '内定比較', tabBarIcon: tabIcon('podium') }} />
      <Tabs.Screen name="settings" options={{ title: '設定', tabBarIcon: tabIcon('settings-sharp') }} />
    </Tabs>
  );
}
