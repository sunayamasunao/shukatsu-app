import React, { useState } from 'react';
import {
  ActivityIndicator, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme, useThemedStyles } from '@/src/context/ThemeContext';
import { Colors, radius, spacing, type } from '@/src/theme';
import { Segmented } from '@/src/components/ui';

type Mode = 'signIn' | 'signUp';

export default function LoginScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async () => {
    if (!email.trim() || !password) {
      setError('メールアドレスとパスワードを入力してください');
      return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);
    const res = mode === 'signIn' ? await signIn(email, password) : await signUp(email, password);
    setBusy(false);
    if (res === 'confirm') {
      setInfo('確認メールを送信しました。メール内のリンクを開いてから、ログインしてください。');
      setMode('signIn');
    } else if (res) {
      setError(res);
    }
    // 成功するとセッションが発行され、ルートのガードがホームへ切り替える
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setInfo(null);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Image source={require('../assets/icon.png')} style={styles.logo} accessibilityIgnoresInvertColors />
          <Text style={styles.title}>就活ノート</Text>
          <Text style={styles.sub}>
            選考の経験を記録して、次の選考と企業選びに活かそう。{'\n'}
            ログインすると、iPhone・iPad など複数の端末で同じデータを使えます。
          </Text>

          {/* ログイン / 新規登録 切り替え */}
          <View style={{ marginBottom: spacing.lg }}>
            <Segmented
              value={mode}
              onChange={switchMode}
              options={[{ value: 'signIn', label: 'ログイン' }, { value: 'signUp', label: '新規登録' }]}
            />
          </View>

          <Text style={styles.label}>メールアドレス</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.fgSub}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
          />
          <Text style={[styles.label, { marginTop: 18 }]}>パスワード</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder={mode === 'signUp' ? '8文字以上' : ''}
            placeholderTextColor={colors.fgSub}
            secureTextEntry
            textContentType={mode === 'signUp' ? 'newPassword' : 'password'}
            autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
            onSubmitEditing={submit}
          />

          {error ? (
            <View style={[styles.message, { backgroundColor: colors.dangerLight }]}>
              <Ionicons name="alert-circle" size={18} color={colors.danger} />
              <Text style={[styles.messageText, { color: colors.danger }]}>{error}</Text>
            </View>
          ) : null}
          {info ? (
            <View style={[styles.message, { backgroundColor: colors.successLight }]}>
              <Ionicons name="mail-outline" size={18} color={colors.success} />
              <Text style={[styles.messageText, { color: colors.success }]}>{info}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.btn, busy && { opacity: 0.6 }]}
            onPress={submit}
            disabled={busy}
            activeOpacity={0.7}
            accessibilityRole="button"
          >
            {busy
              ? <ActivityIndicator color={colors.onPrimary} />
              : <Text style={styles.btnText}>{mode === 'signIn' ? 'ログイン' : 'アカウントを作成'}</Text>}
          </TouchableOpacity>

          <Text style={styles.note}>
            登録に使うのはメールアドレスだけです。就活データは本人のアカウントからしか読み書きできないよう、データベース側で保護しています。
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: {
    paddingHorizontal: spacing.screen + 4, paddingTop: 56, paddingBottom: 32,
    maxWidth: 480, width: '100%', alignSelf: 'center',
  },
  logo: { width: 72, height: 72, borderRadius: 18, alignSelf: 'center' },
  title: { ...type.largeTitle, color: colors.fg, textAlign: 'center', marginTop: 16 },
  sub: { fontSize: 15, lineHeight: 23, color: colors.fgMuted, textAlign: 'center', marginTop: 10, marginBottom: 32 },

  label: { fontSize: 13, fontWeight: '600', color: colors.fgMuted, marginBottom: 8 },
  input: {
    backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, color: colors.fg,
  },
  message: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    borderRadius: radius.md, padding: 12, marginTop: 16,
  },
  messageText: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: '500' },
  btn: {
    backgroundColor: colors.primary, borderRadius: radius.full, paddingVertical: 16, minHeight: 52,
    alignItems: 'center', justifyContent: 'center', marginTop: 24,
  },
  btnText: { color: colors.onPrimary, fontSize: 16, fontWeight: '700' },
  note: { fontSize: 12, lineHeight: 18, color: colors.fgSub, marginTop: 20, textAlign: 'center' },
});
