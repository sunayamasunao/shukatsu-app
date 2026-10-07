import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { Alert, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Company, Selection, Weights } from '../types';
import { DEFAULT_WEIGHTS } from '../constants';
import { uid } from '../utils';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { AppData, SyncEngine, SyncStatus, Snapshot, storageKey } from '../sync/engine';
import { createSupabaseRemote } from '../sync/supabaseRemote';
import { TABLES } from '../sync/schema';

/** クラウド対応前の保存キー（初回起動時に取り込む） */
const LEGACY_KEY = '@shukatsu:companies_v1';
const LEGACY_WEIGHTS_KEY = '@shukatsu:weights_v1';
const DEVICE_KEY = '@shukatsu:device_id';

/** 編集後、まとめて送信するまでの待ち時間 */
const PUSH_DEBOUNCE_MS = 800;
/** Realtime が切れていても取りこぼさないための定期同期 */
const POLL_MS = 60_000;

interface CompaniesContextValue {
  companies: Company[];
  loading: boolean;
  addCompany: (c: Company) => Promise<void>;
  updateCompany: (id: string, data: Partial<Company>) => Promise<void>;
  deleteCompany: (id: string) => Promise<void>;
  replaceAll: (list: Company[]) => Promise<void>;
  /** 1つの選考だけを更新（振り返り・準備タスクなど） */
  updateSelection: (companyId: string, selectionId: string, data: Partial<Selection>) => Promise<void>;
  /** 内定比較の重視度 */
  weights: Weights;
  setWeights: (w: Weights) => Promise<void>;
  /** 同期の状態（未送信件数・競合・最終同期時刻など） */
  sync: SyncStatus;
  /** 今すぐ同期し、クラウドにまだ無い変更の件数（未送信 + 保存できなかった変更）を返す */
  syncNow: () => Promise<number>;
  resolveConflict: (key: string, choice: 'mine' | 'theirs') => Promise<void>;
  /** クラウドに保存できなかった変更を取り消し、クラウドの内容に戻す */
  discardRejected: (key: string) => Promise<void>;
  /** ログイン前からこの端末にだけあるデータの企業数（0 なら無し） */
  localOnlyCount: number;
  /** その端末だけのデータをアカウントへ移す（クラウドに保存され、他の端末にも同期される） */
  importLocalData: () => Promise<void>;
  /** ログアウト前に、この端末に保存したデータを消す */
  discardLocalData: () => Promise<void>;
}

const CompaniesContext = createContext<CompaniesContextValue | null>(null);

const IDLE_STATUS: SyncStatus = { phase: 'local', pending: 0, rejected: [], conflicts: [], lastSyncedAt: null, error: null };
const EMPTY: Snapshot = { companies: [], weights: null, status: IDLE_STATUS };
const noopSubscribe = () => () => {};

async function getDeviceId(): Promise<string> {
  const saved = await AsyncStorage.getItem(DEVICE_KEY);
  if (saved) return saved;
  const id = `dev_${uid()}`;
  await AsyncStorage.setItem(DEVICE_KEY, id);
  return id;
}

/** クラウド対応前のデータ（1キーに企業配列を丸ごと保存していた形式） */
async function readLegacy(): Promise<AppData | null> {
  const [raw, w] = await Promise.all([AsyncStorage.getItem(LEGACY_KEY), AsyncStorage.getItem(LEGACY_WEIGHTS_KEY)]);
  if (!raw && !w) return null;
  return {
    companies: raw ? (JSON.parse(raw) as Company[]) : [],
    weights: w ? { ...DEFAULT_WEIGHTS, ...JSON.parse(w) } : null,
  };
}

/** 取り込み済みの旧データは消さずにバックアップとして残す */
async function retireLegacy(): Promise<void> {
  const raw = await AsyncStorage.getItem(LEGACY_KEY);
  if (raw) await AsyncStorage.setItem(`${LEGACY_KEY}_backup`, raw);
  await AsyncStorage.multiRemove([LEGACY_KEY, LEGACY_WEIGHTS_KEY]);
}

/** 既存の企業と id が重ならないものだけ追加する */
function appendData(cur: AppData, extra: AppData): AppData {
  const ids = new Set(cur.companies.map((c) => c.id));
  return {
    companies: [...cur.companies, ...extra.companies.filter((c) => !ids.has(c.id))],
    weights: cur.weights ?? extra.weights,
  };
}

export function CompaniesProvider({ children }: { children: React.ReactNode }) {
  const { userId, cloud } = useAuth();
  const [engine, setEngine] = useState<SyncEngine | null>(null);
  const [localOnly, setLocalOnly] = useState<LocalOnlyData | null>(null);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── ユーザーごとにエンジンを用意 ─────────────────
  useEffect(() => {
    if (!userId) {
      setEngine(null);
      return;
    }
    let cancelled = false;
    let created: SyncEngine | null = null;

    (async () => {
      const deviceId = await getDeviceId();
      const remote = cloud && supabase ? createSupabaseRemote(supabase, userId) : null;
      const e = new SyncEngine({ userId, deviceId, remote, store: AsyncStorage });
      created = e;
      await e.load();
      if (cancelled) return e.dispose();

      if (!remote) {
        // ローカル専用モード: 旧形式のデータをそのまま引き継ぐ
        const legacy = await readLegacy();
        if (legacy) {
          await e.mutate((cur) => appendData(cur, legacy));
          await retireLegacy();
        }
      }
      setEngine(e);
      if (remote) {
        await e.sync();
        const found = await findLocalOnlyData();
        if (cancelled) return;
        setLocalOnly(found);
        if (found) askImport(found.data.companies.length, () => importInto(e, found));
      }
    })().catch(console.error);

    return () => {
      cancelled = true;
      created?.dispose();
      setLocalOnly(null);
    };
  }, [userId, cloud]);

  const importInto = useCallback(async (e: SyncEngine, found: LocalOnlyData) => {
    await e.mutate((cur) => appendData(cur, found.data));
    if (found.fromLocalMode) await AsyncStorage.removeItem(storageKey('local'));
    else await retireLegacy();
    setLocalOnly(null);
    await e.sync();
  }, []);

  // ─── 同期のきっかけ ────────────────────────────
  useEffect(() => {
    if (!engine || !cloud || !supabase) return;
    const client = supabase;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const soon = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => engine.sync(), 300);
    };

    // 他の端末の変更をすぐに受け取る（RLS により自分の行の変更だけが届く）
    let channel = client.channel(`sync:${engine.userId}`);
    for (const table of TABLES) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `user_id=eq.${engine.userId}` },
        soon,
      );
    }
    channel.subscribe();

    // アプリに戻ってきたとき・定期的にも同期（Realtime が切れていた間の取りこぼし対策）
    const appSub = AppState.addEventListener('change', (s) => { if (s === 'active') engine.sync(); });
    const poll = setInterval(() => engine.sync(), POLL_MS);

    return () => {
      if (timer) clearTimeout(timer);
      client.removeChannel(channel);
      appSub.remove();
      clearInterval(poll);
    };
  }, [engine, cloud]);

  const snapshot = useSyncExternalStore(
    engine?.subscribe ?? noopSubscribe,
    engine?.getSnapshot ?? (() => EMPTY),
  );

  // ─── 編集 ──────────────────────────────────────
  const scheduleSync = useCallback(() => {
    if (!engine || !cloud) return;
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(() => engine.sync(), PUSH_DEBOUNCE_MS);
  }, [engine, cloud]);

  const mutateData = useCallback(async (fn: (d: AppData) => AppData) => {
    if (!engine) return;
    await engine.mutate(fn);
    scheduleSync();
  }, [engine, scheduleSync]);

  const mutate = useCallback(
    (fn: (list: Company[]) => Company[]) => mutateData((d) => ({ ...d, companies: fn(d.companies) })),
    [mutateData],
  );

  const addCompany = useCallback(
    async (c: Company) => mutate((list) => [...list, c]),
    [mutate],
  );

  const updateCompany = useCallback(
    async (id: string, data: Partial<Company>) =>
      mutate((list) => list.map((c) => (c.id === id ? { ...c, ...data } : c))),
    [mutate],
  );

  const deleteCompany = useCallback(
    async (id: string) => mutate((list) => list.filter((c) => c.id !== id)),
    [mutate],
  );

  const replaceAll = useCallback(
    async (list: Company[]) => mutate(() => list),
    [mutate],
  );

  const updateSelection = useCallback(
    async (companyId: string, selectionId: string, data: Partial<Selection>) =>
      mutate((list) => list.map((c) => (c.id !== companyId ? c : {
        ...c,
        flows: c.flows.map((f) => (f.id === selectionId ? { ...f, ...data } : f)),
      }))),
    [mutate],
  );

  const setWeights = useCallback(
    async (w: Weights) => mutateData((d) => ({ ...d, weights: w })),
    [mutateData],
  );

  const syncNow = useCallback(async () => {
    if (!engine) return 0;
    await engine.sync();
    const st = engine.getSnapshot().status;
    return st.pending + st.rejected.length;
  }, [engine]);

  const discardRejected = useCallback(async (key: string) => {
    if (!engine) return;
    await engine.discardRejected(key);
  }, [engine]);

  const importLocalData = useCallback(async () => {
    if (engine && localOnly) await importInto(engine, localOnly);
  }, [engine, localOnly, importInto]);

  const resolveConflict = useCallback(async (key: string, choice: 'mine' | 'theirs') => {
    if (!engine) return;
    await engine.resolveConflict(key, choice);
    scheduleSync();
  }, [engine, scheduleSync]);

  const discardLocalData = useCallback(async () => {
    if (!engine) return;
    await engine.clearLocal();
    setEngine(null);
  }, [engine]);

  const weights = useMemo(
    () => ({ ...DEFAULT_WEIGHTS, ...(snapshot.weights ?? {}) }),
    [snapshot.weights],
  );

  return (
    <CompaniesContext.Provider
      value={{
        companies: snapshot.companies,
        loading: !engine,
        addCompany, updateCompany, deleteCompany, replaceAll,
        updateSelection, weights, setWeights,
        sync: snapshot.status, syncNow, resolveConflict, discardLocalData, discardRejected,
        localOnlyCount: localOnly?.data.companies.length ?? 0, importLocalData,
      }}
    >
      {children}
    </CompaniesContext.Provider>
  );
}

interface LocalOnlyData {
  data: AppData;
  /** ローカル保存モードのデータか（false = クラウド対応前の旧形式） */
  fromLocalMode: boolean;
}

/**
 * ログイン前からこの端末にだけ保存されているデータ（クラウド対応前の旧形式、
 * または .env 未設定で使っていたローカル保存モード）を探す。
 * これはまだどのアカウントにも属さず、クラウドにも無いので、移行するまで他の端末からは見えない。
 */
async function findLocalOnlyData(): Promise<LocalOnlyData | null> {
  const legacy = await readLegacy();
  if (legacy && legacy.companies.length > 0) return { data: legacy, fromLocalMode: false };
  const localMode = new SyncEngine({ userId: 'local', deviceId: 'local', remote: null, store: AsyncStorage });
  await localMode.load();
  const snap = localMode.getSnapshot();
  localMode.dispose();
  if (snap.companies.length === 0) return null;
  return { data: { companies: snap.companies, weights: snap.weights }, fromLocalMode: true };
}

function askImport(count: number, onImport: () => void) {
  Alert.alert(
    'この端末のデータを移行',
    `この端末に保存されている${count}社のデータを、ログイン中のアカウントに移しますか？
移したデータはクラウドに保存され、他の端末にも同期されます。
（「あとで」を選んでも、設定画面からいつでも移行できます）`,
    [
      { text: 'あとで', style: 'cancel' },
      { text: '移行する', onPress: onImport },
    ],
  );
}

export function useCompanies(): CompaniesContextValue {
  const ctx = useContext(CompaniesContext);
  if (!ctx) throw new Error('useCompanies must be used within CompaniesProvider');
  return ctx;
}
