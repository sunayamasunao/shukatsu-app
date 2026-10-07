// Supabase への接続確認（アプリを起動せずに、開発 PC から確認する）
//
//   npm run check:supabase
//
// 確認すること
//   1. .env に URL と Publishable key があり、secret / service_role key ではない
//   2. .env が Git の管理対象外になっている
//   3. URL とキーで Supabase に接続できる（Auth の設定を取得）
//   4. マイグレーション済みのテーブルがあり、未ログインでは読めない（RLS / 権限）
//   5. 未ログインではアカウント削除の関数を呼べない
// キーの値は画面に表示しない。
import { execFileSync } from 'node:child_process';

const url = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

let failed = 0;
const ok = (msg) => console.log(`  ✅ ${msg}`);
const warn = (msg) => console.log(`  ⚠️  ${msg}`);
const ng = (msg) => { failed++; console.log(`  ❌ ${msg}`); };

function keyKind(k) {
  if (k.startsWith('sb_publishable_')) return 'publishable';
  if (k.startsWith('sb_secret_')) return 'secret';
  const payload = k.split('.')[1];
  if (payload) {
    try {
      const role = JSON.parse(Buffer.from(payload, 'base64url').toString()).role;
      if (role === 'anon') return 'anon';
      if (role === 'service_role') return 'service_role';
    } catch { /* 下で unknown */ }
  }
  return 'unknown';
}

async function request(path, init = {}) {
  const headers = { apikey: key, ...(init.headers ?? {}) };
  // 旧形式の anon key（JWT）は Authorization にも入れる。publishable key は apikey だけでよい
  if (key.split('.').length === 3) headers.Authorization = `Bearer ${key}`;
  const res = await fetch(`${url}${path}`, { ...init, headers });
  let body = null;
  try { body = await res.json(); } catch { /* 本文なし */ }
  return { status: res.status, body };
}

console.log('\n1. .env の内容');
if (!url) ng('EXPO_PUBLIC_SUPABASE_URL が設定されていません');
else if (/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url)) ok(`URL: ${url}`);
else warn(`URL の形式がいつもと違います: ${url}（https://<project-ref>.supabase.co の形か確認してください）`);

const kind = key ? keyKind(key) : 'none';
if (kind === 'none') ng('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY が設定されていません');
else if (kind === 'secret' || kind === 'service_role') {
  ng(`${kind} key が設定されています。今すぐ .env から削除し、Publishable key に置き換えてください`);
  ng('（このキーを Git やチャットに貼っていた場合は、ダッシュボードでキーを再発行してください）');
} else if (kind === 'publishable') ok(`Publishable key（${key.slice(0, 18)}…）`);
else if (kind === 'anon') ok('anon key（旧形式）');
else warn('キーの形式を判別できませんでした。Publishable key（sb_publishable_...）か確認してください');

console.log('\n2. .env が Git にコミットされないか');
try {
  execFileSync('git', ['check-ignore', '-q', '.env']);
  ok('.env は .gitignore で除外されています');
} catch {
  ng('.env が Git の管理対象になっています。.gitignore に .env を追加してください');
}

if (failed > 0 || kind === 'secret' || kind === 'service_role') {
  console.log('\n上の ❌ を直してから、もう一度実行してください。\n');
  process.exit(1);
}

try {
  console.log('\n3. Supabase への接続');
  const settings = await request('/auth/v1/settings');
  if (settings.status === 200) {
    ok('接続できました（URL とキーが正しい）');
    if (settings.body?.external?.email === false) ng('メール認証（Email provider）が無効です。Authentication → Sign In / Providers で有効にしてください');
    else ok('メール + パスワードでのログインが有効です');
    if (settings.body?.mailer_autoconfirm) ok('Confirm email: オフ（登録後すぐにログインできます）');
    else warn('Confirm email: オン（登録後、確認メールのリンクを開くまでログインできません。開発中はオフがおすすめ）');
  } else {
    ng(`接続できません（HTTP ${settings.status}）。URL とキーの組み合わせが同じプロジェクトのものか確認してください`);
  }

  console.log('\n4. テーブルと RLS（未ログインで companies を読む → 拒否されるのが正しい）');
  const table = await request('/rest/v1/companies?select=id&limit=1');
  const code = table.body?.code;
  if ((table.status === 401 || table.status === 403) && code === '42501') {
    ok('companies テーブルがあり、未ログインでは読めません');
  } else if (code === 'PGRST205' || code === '42P01' || table.status === 404) {
    ng('companies テーブルが見つかりません。マイグレーションを実行したプロジェクトか確認してください');
  } else if (table.status === 200) {
    ng('未ログインで companies が読めてしまいます。マイグレーションの revoke / RLS が適用されているか確認してください');
  } else {
    warn(`想定外の応答です（HTTP ${table.status} ${code ?? ''} ${table.body?.message ?? ''}）`);
  }

  console.log('\n5. アカウント削除の関数（未ログインでは呼べないのが正しい）');
  const rpc = await request('/rest/v1/rpc/delete_my_account', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
  });
  if (rpc.status === 401 || rpc.status === 403) ok('未ログインでは実行できません');
  else if (rpc.body?.code === 'PGRST202') ng('delete_my_account 関数が見つかりません。マイグレーションを確認してください');
  else ng(`未ログインで実行できてしまう可能性があります（HTTP ${rpc.status}）`);
} catch (e) {
  ng(`通信に失敗しました: ${e.message}（URL の打ち間違い、またはネットワークを確認してください）`);
}

console.log(failed === 0
  ? '\n🎉 接続の準備ができました。npx expo start -c でアプリを起動してください。\n'
  : '\n上の ❌ を確認してください。\n');
process.exit(failed === 0 ? 0 : 1);
