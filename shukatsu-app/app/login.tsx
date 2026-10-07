import React, { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme, useThemedStyles } from '@/src/context/ThemeContext';
import { Colors, radius, shadow, spacing } from '@/src/theme';

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
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.logo}>📋</Text>
          <Text style={styles.title}>就活ノート</Text>
          <Text style={styles.sub}>
            選考の経験を記録して、次の選考と企業選びに活かそう。{'\n'}
            ログインすると、iPhone・iPad など複数の端末で同じデータを使えます。
          </Text>

          {/* ログイン / 新規登録 切り替え */}
          <View style={styles.segment}>
            {([['signIn', 'ログイン'], ['signUp', '新規登録']] as [Mode, string][]).map(([m, label]) => (
              <TouchableOpacity
                key={m}
                style={[styles.segItem, mode === m && styles.segItemActive]}
                onPress={() => switchMode(m)}
              >
                <Text style={[styles.segText, mode === m && styles.segTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.card}>
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
            <Text style={[styles.label, { marginTop: 14 }]}>パスワード</Text>
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

            {error ? <Text style={styles.error}>{error}</Text> : null}
            {info ? <Text style={styles.info}>{info}</Text> : null}

            <TouchableOpacity style={[styles.btn, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy}>
              {busy
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>{mode === 'signIn' ? 'ログイン' : 'アカウントを作成'}</Text>}
            </TouchableOpacity>
          </View>

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
  content: { padding: spacing.lg, paddingTop: 56, maxWidth: 480, width: '100%', alignSelf: 'center' },
  logo: { fontSize: 48, textAlign: 'center' },
  title: { fontSize: 26, fontWeight: '700', color: colors.fg, textAlign: 'center', marginTop: 8, letterSpacing: -0.5 },
  sub: { fontSize: 14, lineHeight: 21, color: colors.fgMuted, textAlign: 'center', marginTop: 10, marginBottom: 28 },

  segment: {
    flexDirection: 'row', backgroundColor: colors.surface2, borderRadius: radius.sm,
    padding: 3, marginBottom: 14,
  },
  segItem: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: radius.sm - 2 },
  segItemActive: { backgroundColor: colors.surface, ...shadow },
  segText: { fontSize: 14, fontWeight: '600', color: colors.fgMuted },
  segTextActive: { color: colors.fg },

  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, ...shadow },
  label: { fontSize: 13, fontWeight: '600', color: colors.fgMuted, marginBottom: 6 },
  input: {
    backgroundColor: colors.surface2, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 11,
    fontSize: 15, color: colors.fg,
  },
  error: { color: colors.danger, fontSize: 13, marginTop: 12, lineHeight: 19 },
  info: { color: colors.success, fontSize: 13, marginTop: 12, lineHeight: 19 },
  btn: {
    backgroundColor: colors.primary, borderRadius: radius.sm, paddingVertical: 14,
    alignItems: 'center', marginTop: 18,
  },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  note: { fontSize: 12, lineHeight: 18, color: colors.fgSub, marginTop: 18, textAlign: 'center' },
});
