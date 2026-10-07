import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isCloudEnabled, supabase } from '../lib/supabase';

interface AuthContextValue {
  /** クラウド同期が有効か（.env に Supabase が設定されているか） */
  cloud: boolean;
  session: Session | null;
  /** データの持ち主。ローカル専用モードでは 'local' */
  userId: string | null;
  email: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  /** @returns エラーメッセージ / 'confirm'（確認メール送信済み）/ null（成功） */
  signUp: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Supabase のエラーを利用者向けの日本語にする */
function messageOf(error: { message: string; code?: string } | null): string | null {
  if (!error) return null;
  const m = error.message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'メールアドレスまたはパスワードが違います';
  if (m.includes('email not confirmed')) return 'メールアドレスの確認が完了していません。届いたメールのリンクを開いてください';
  if (m.includes('already registered')) return 'このメールアドレスは既に登録されています';
  if (m.includes('password should be')) return 'パスワードは8文字以上にしてください';
  if (m.includes('network') || m.includes('fetch')) return '通信できませんでした。電波の良いところで再度お試しください';
  return error.message;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isCloudEnabled);

  useEffect(() => {
    if (!supabase) return;
    // 保存済みのセッションを復元（オフラインでも端末内のセッションで起動できる）
    supabase.auth.getSession()
      .then(({ data }) => setSession(data.session))
      .finally(() => setLoading(false));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) return null;
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return messageOf(error);
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    if (!supabase) return null;
    if (password.length < 8) return 'パスワードは8文字以上にしてください';
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
    if (error) return messageOf(error);
    // メール確認が有効なプロジェクトでは、確認するまでセッションが発行されない
    return data.session ? null : 'confirm';
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    // 通信できなくても端末からはログアウトできるように scope: 'local'
    await supabase.auth.signOut({ scope: 'local' });
  }, []);

  const deleteAccount = useCallback(async () => {
    if (!supabase) return null;
    const { error } = await supabase.rpc('delete_my_account');
    if (error) return messageOf(error);
    await supabase.auth.signOut({ scope: 'local' });
    return null;
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    cloud: isCloudEnabled,
    session,
    userId: isCloudEnabled ? session?.user.id ?? null : 'local',
    email: session?.user.email ?? null,
    loading,
    signIn, signUp, signOut, deleteAccount,
  }), [session, loading, signIn, signUp, signOut, deleteAccount]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
