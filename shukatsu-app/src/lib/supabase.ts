import 'react-native-url-polyfill/auto';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * 接続情報は .env（EXPO_PUBLIC_*）から読む。コードには書かない。
 * Publishable key（旧 anon key）はアプリに埋め込まれる前提の公開キーで、データの保護は DB の RLS が担う。
 * secret key / service_role key は RLS を無視できるので、絶対にアプリに入れないこと。
 *
 * Expo はビルド時に process.env.EXPO_PUBLIC_* を値に置き換えるため、変数名は省略せずに書く必要がある。
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publicKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** secret key / service_role key が設定されていたら起動を止める */
function assertPublicKey(key: string): void {
  if (key.startsWith('sb_secret_')) {
    throw new Error('.env に secret key が設定されています。アプリには Publishable key（sb_publishable_...）だけを設定してください。');
  }
  // 旧形式の JWT キー: payload の role が service_role なら拒否
  const payload = key.split('.')[1];
  if (payload) {
    try {
      const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
      const json = JSON.parse(globalThis.atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, '=')));
      if (json.role === 'service_role') {
        throw new Error('.env に service_role key が設定されています。アプリには anon key だけを設定してください。');
      }
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('.env')) throw e;
    }
  }
}

if (publicKey) assertPublicKey(publicKey);

/** 未設定ならローカル保存モード（従来どおり端末内だけに保存）で動く */
export const supabase: SupabaseClient | null = url && publicKey
  ? createClient(url, publicKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  })
  : null;

export const isCloudEnabled = supabase !== null;

// アプリが前面にある間だけトークンを自動更新する（Supabase 推奨の設定）
if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
