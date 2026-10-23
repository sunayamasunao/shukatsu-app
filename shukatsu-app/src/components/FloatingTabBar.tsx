/**
 * 画面下に浮かぶすりガラス（背景ぼかし）・角丸のタブバー。
 * 選択中を示すピルが、タブを切り替えるとバネのように滑らかに移動する。
 * タブの切り替えは React Navigation 標準の手順（tabPress イベント → navigate）に従う。
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Tabs } from 'expo-router';
import { BlurView } from 'expo-blur';
import { useTheme, useThemedStyles } from '../context/ThemeContext';
import { Colors, radius } from '../theme';

type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

const PAD = 6;

export function FloatingTabBar({ state, descriptors, navigation, insets }: TabBarProps) {
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [barWidth, setBarWidth] = useState(0);
  const position = useRef(new Animated.Value(state.index)).current;

  useEffect(() => {
    Animated.spring(position, {
      toValue: state.index,
      useNativeDriver: true,
      damping: 18,
      stiffness: 220,
      mass: 0.8,
    }).start();
  }, [state.index, position]);

  const count = state.routes.length;
  const itemWidth = barWidth > 0 ? (barWidth - PAD * 2) / count : 0;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { paddingBottom: Math.max(insets.bottom - 4, 12) }]}
    >
      <View style={styles.shadow}>
        <View style={styles.bar} onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}>
          {/* すりガラス: 後ろの内容をぼかして透かす（iOS はいちばん薄い素材を使い、色は重ねない） */}
          <BlurView
            tint={isDark ? 'systemUltraThinMaterialDark' : 'systemUltraThinMaterialLight'}
            intensity={Platform.OS === 'ios' ? 100 : 60}
            blurMethod="dimezisBlurViewSdk31Plus"
            style={StyleSheet.absoluteFill}
          />
          {Platform.OS !== 'ios' && (
            // Android の古い端末などでぼかしが効かない場合に、文字が読めるよう薄く色を敷く
            <View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(30,30,34,0.55)' : 'rgba(255,255,255,0.6)' }]}
            />
          )}
          {/* 選択中のピル（タブの下を滑って移動する） */}
          {itemWidth > 0 && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.indicator,
                {
                  width: itemWidth,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.07)',
                  transform: [{ translateX: Animated.multiply(position, itemWidth) }],
                },
              ]}
            />
          )}

          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const focused = state.index === index;
            const label = typeof options.title === 'string' ? options.title : route.name;
            const color = focused ? colors.fg : colors.fgMuted;

            const onPress = () => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
            };
            const onLongPress = () => navigation.emit({ type: 'tabLongPress', target: route.key });

            return (
              <TouchableOpacity
                key={route.key}
                style={styles.item}
                onPress={onPress}
                onLongPress={onLongPress}
                activeOpacity={0.6}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              >
                {options.tabBarIcon?.({ focused, color, size: 24 })}
                <Text style={[styles.label, { color }]} numberOfLines={1}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  // 画面の上に重ねて表示し、内容がバーの後ろを通るようにする
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  // 影は外側、角丸の切り抜き（ぼかし用）は内側で付ける
  shadow: {
    width: '100%',
    maxWidth: 440,
    borderRadius: radius.full,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 20,
      },
      android: { elevation: 8 },
    }),
  },
  bar: {
    flexDirection: 'row',
    padding: PAD,
    borderRadius: radius.full,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    // ガラスの縁のような、ごく薄い線
    borderColor: 'rgba(127,127,127,0.25)',
  },
  indicator: {
    position: 'absolute',
    top: PAD,
    bottom: PAD,
    left: PAD,
    borderRadius: radius.full,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 8,
  },
  label: { fontSize: 11, fontWeight: '700' },
});
