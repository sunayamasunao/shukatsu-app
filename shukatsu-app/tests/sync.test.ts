/**
 * 複数端末の同期テスト（iPhone / iPad を2つの SyncEngine で再現する）
 *
 *   npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SyncEngine } from '../src/sync/engine.ts';
import type { AppData } from '../src/sync/mapping.ts';
import { assemble, flatten } from '../src/sync/mapping.ts';
import { buildCalendarEvents, buildCarryOver } from '../src/utils/index.ts';
import type { Company, CompanyEvaluation, Selection, SelectionReview, SelfRatings } from '../src/types/index.ts';
import { FakeServer, MemoryStore } from './fakeRemote.ts';

const USER_A = '00000000-0000-0000-0000-00000000000a';
const USER_B = '00000000-0000-0000-0000-00000000000b';

async function device(server: FakeServer, user: string, name: string, store = new MemoryStore()) {
  const remote = server.connect(user);
  const engine = new SyncEngine({ userId: user, deviceId: name, remote, store });
  await engine.load();
  return { engine, remote, store };
}

const list = (e: SyncEngine) => e.getSnapshot().companies;
const find = (e: SyncEngine, id: string) => list(e).find((c) => c.id === id);

function company(id: string, name: string, extra: Partial<Company> = {}): Company {
  return {
    id, name, jobType: '', industry: 'IT・Web', mypageUrl: '', status: 'active', flows: [],
    avgSalary: '', employees: '', location: '', founded: '', benefits: '', business: '',
    notes: '', concerns: '', createdAt: '2026-09-01T00:00:00.000Z', ...extra,
  };
}

/** 企業 → 選考 → 振り返り → 質問 / 準備タスク まで入った企業 */
function fullCompany(id: string): Company {
  return company(id, '株式会社テスト', {
    evaluation: { work: 5, salary: 3 },
    motivationHistory: [{ id: `${id}_2026-09-01`, date: '2026-09-01', value: 60 }],
    decision: { reason: '人', hesitation: '', expectation: '' },
    flows: [
      {
        id: `${id}-s1`, name: '1次面接', kind: '1次面接', date: '2026-10-08', time: '10:00',
        online: true, deadline: '', status: 'passed',
        tasks: [{ id: `${id}-t1`, text: '企業研究', done: true }],
        review: {
          result: 'passed', date: '2026-10-08', time: '10:00', format: 'オンライン', interviewerCount: 2,
          questions: [{ id: `${id}-q1`, text: 'ガクチカ', answer: 'USJでの接客' }],
          answerNotes: '', goodPoints: 'ガクチカ', stuckPoints: '', positiveReactions: 'USJでの接客経験',
          improvements: 'IT業界を志望する理由を具体化する', ratings: { motivation: 2 },
          updatedAt: '2026-10-08T12:00:00.000Z',
        },
      },
      { id: `${id}-s2`, name: '2次面接', kind: '2次面接', date: '2026-10-15', deadline: '2026-10-10', status: 'pending' },
    ],
  });
}

const add = (e: SyncEngine, c: Company) => e.mutate((d) => ({ ...d, companies: [...d.companies, c] }));
const update = (e: SyncEngine, id: string, data: Partial<Company>) =>
  e.mutate((d) => ({ ...d, companies: d.companies.map((c) => (c.id === id ? { ...c, ...data } : c)) }));
const recordMotivation = (e: SyncEngine, id: string, date: string, value: number) =>
  e.mutate((d) => ({
    ...d,
    companies: d.companies.map((c) => (c.id !== id ? c : {
      ...c,
      motivationHistory: [...(c.motivationHistory ?? []).filter((r) => r.date !== date), { id: `${id}_${date}`, date, value }],
    })),
  }));

// ─── データ変換 ────────────────────────────────────

test('入れ子データ ⇔ DBの行 の変換で情報が失われない', () => {
  const app: AppData = { companies: [fullCompany('c1')], weights: null };
  const rows = flatten(app, USER_A);
  assert.equal(Object.keys(rows.selection_reviews).length, 1);
  assert.equal(Object.keys(rows.interview_questions).length, 1);
  const back = assemble(rows, USER_A);
  assert.deepEqual(flatten(back, USER_A), rows);
  assert.equal(back.companies[0].flows[0].review?.questions[0].text, 'ガクチカ');
});

// ─── 永続化 ────────────────────────────────────────

test('アプリを再起動してもデータが残る', async () => {
  const server = new FakeServer();
  const store = new MemoryStore();
  const a = await device(server, USER_A, 'iphone', store);
  await add(a.engine, fullCompany('c1'));
  a.engine.dispose();

  const restarted = await device(server, USER_A, 'iphone', store);
  assert.equal(list(restarted.engine).length, 1);
  assert.equal(find(restarted.engine, 'c1')?.flows[0].review?.improvements, 'IT業界を志望する理由を具体化する');
});

test('ログアウト（端末のデータ削除）→ 再ログインでクラウドから復元される', async () => {
  const server = new FakeServer();
  const a = await device(server, USER_A, 'iphone');
  await add(a.engine, fullCompany('c1'));
  await a.engine.sync();
  const before = list(a.engine);
  await a.engine.clearLocal();
  assert.equal(a.store.map.size, 0, 'ログアウトで端末から消える');

  const again = await device(server, USER_A, 'iphone', a.store);
  assert.equal(list(again.engine).length, 0);
  await again.engine.sync();
  assert.deepEqual(list(again.engine), before);
});

// ─── 複数端末同期 ───────────────────────────────────

test('iPhoneで追加した企業がiPadに表示され、iPadの変更がiPhoneに反映される', async () => {
  const server = new FakeServer();
  const iphone = await device(server, USER_A, 'iphone');
  const ipad = await device(server, USER_A, 'ipad');

  await add(iphone.engine, fullCompany('c1'));
  await iphone.engine.sync();
  await ipad.engine.sync();
  assert.deepEqual(list(ipad.engine), list(iphone.engine));

  await update(ipad.engine, 'c1', { status: 'offer', notes: '雰囲気が良い' });
  await ipad.engine.sync();
  await iphone.engine.sync();
  assert.equal(find(iphone.engine, 'c1')?.status, 'offer');
  assert.equal(find(iphone.engine, 'c1')?.notes, '雰囲気が良い');
});

test('企業・選考・振り返りの関連が他端末でも壊れず、引き継ぎも同じになる', async () => {
  const server = new FakeServer();
  const iphone = await device(server, USER_A, 'iphone');
  const ipad = await device(server, USER_A, 'ipad');
  await add(iphone.engine, fullCompany('c1'));
  await iphone.engine.sync();
  await ipad.engine.sync();

  const c = find(ipad.engine, 'c1')!;
  assert.deepEqual(c.flows.map((f) => f.name), ['1次面接', '2次面接']);
  const carry = buildCarryOver(c, 'c1-s2').map((x) => `${x.icon}${x.text}`);
  assert.ok(carry.includes('⚠️IT業界を志望する理由を具体化する'));
  assert.ok(carry.some((t) => t.startsWith('⭐USJでの接客経験')));
  assert.deepEqual(carry, buildCarryOver(find(iphone.engine, 'c1')!, 'c1-s2').map((x) => `${x.icon}${x.text}`));
});

test('カレンダー: iPhoneで登録・変更した選考日程がiPadのカレンダーに出る', async () => {
  const server = new FakeServer();
  const iphone = await device(server, USER_A, 'iphone');
  const ipad = await device(server, USER_A, 'ipad');
  await add(iphone.engine, fullCompany('c1'));
  await iphone.engine.sync();
  await ipad.engine.sync();

  const ev = (e: SyncEngine) => buildCalendarEvents(list(e)).map((x) => `${x.date} ${x.selectionName} ${x.type}`);
  assert.deepEqual(ev(ipad.engine), ['2026-10-08 1次面接 event', '2026-10-10 2次面接 deadline', '2026-10-15 2次面接 event']);

  // 日程変更 → 相手のカレンダーも移動。タップ時の遷移先（企業・選考ID）も一致
  await iphone.engine.mutate((d) => ({
    ...d,
    companies: d.companies.map((c) => ({ ...c, flows: c.flows.map((f) => (f.id === 'c1-s2' ? { ...f, date: '2026-10-20' } : f)) })),
  }));
  await iphone.engine.sync();
  await ipad.engine.sync();
  assert.ok(ev(ipad.engine).includes('2026-10-20 2次面接 event'));
  assert.ok(!ev(ipad.engine).includes('2026-10-15 2次面接 event'));
  const e = buildCalendarEvents(list(ipad.engine)).find((x) => x.date === '2026-10-20')!;
  assert.equal(e.companyId, 'c1');
  assert.equal(e.selectionId, 'c1-s2');
});

// ─── 同時編集 ──────────────────────────────────────

test('別々の項目を同時に編集 → 両方の変更が残る（自動マージ）', async () => {
  const server = new FakeServer();
  const iphone = await device(server, USER_A, 'iphone');
  const ipad = await device(server, USER_A, 'ipad');
  await add(iphone.engine, fullCompany('c1'));
  await iphone.engine.sync();
  await ipad.engine.sync();

  await update(iphone.engine, 'c1', { notes: 'iPhoneで書いたメモ' });
  await update(ipad.engine, 'c1', { concerns: 'iPadで書いた懸念点' });
  await iphone.engine.sync();
  await ipad.engine.sync();
  await iphone.engine.sync();

  for (const d of [iphone, ipad]) {
    const c = find(d.engine, 'c1')!;
    assert.equal(c.notes, 'iPhoneで書いたメモ');
    assert.equal(c.concerns, 'iPadで書いた懸念点');
    assert.equal(d.engine.getSnapshot().status.conflicts.length, 0);
  }
});

test('同じ項目を同時に編集（志望度 80% と 90%）→ データは壊れず、競合として通知される', async () => {
  const server = new FakeServer();
  const iphone = await device(server, USER_A, 'iphone');
  const ipad = await device(server, USER_A, 'ipad');
  await add(iphone.engine, fullCompany('c1'));
  await iphone.engine.sync();
  await ipad.engine.sync();

  await recordMotivation(iphone.engine, 'c1', '2026-10-07', 80);
  await recordMotivation(ipad.engine, 'c1', '2026-10-07', 90);
  await iphone.engine.sync(); // 先に届いた方
  await ipad.engine.sync();
  await iphone.engine.sync();

  const today = (e: SyncEngine) => find(e, 'c1')!.motivationHistory!.filter((r) => r.date === '2026-10-07');
  // 1日1件のまま（重複しない）・両端末で同じ値
  assert.equal(today(iphone.engine).length, 1);
  assert.deepEqual(today(ipad.engine), today(iphone.engine));
  assert.equal(today(ipad.engine)[0].value, 80);

  // 後から届いた端末に「別の端末で更新されています」が出る
  const conflicts = ipad.engine.getSnapshot().status.conflicts;
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].field, 'value');
  assert.equal(conflicts[0].mine, 90);
  assert.equal(conflicts[0].theirs, 80);
  assert.equal(conflicts[0].label, '株式会社テスト / 志望度');
  assert.equal(conflicts[0].companyId, 'c1');

  // 利用者が「この端末の内容にする」を選ぶ → 90% が全端末に反映
  await ipad.engine.resolveConflict(conflicts[0].key, 'mine');
  await ipad.engine.sync();
  await iphone.engine.sync();
  assert.equal(today(iphone.engine)[0].value, 90);
  assert.equal(ipad.engine.getSnapshot().status.conflicts.length, 0);
});

test('自分の評価（★）を別々の項目で同時に初めて付けても両方残る', async () => {
  const server = new FakeServer();
  const iphone = await device(server, USER_A, 'iphone');
  const ipad = await device(server, USER_A, 'ipad');
  await add(iphone.engine, company('c1', 'A社'));
  await iphone.engine.sync();
  await ipad.engine.sync();

  await update(iphone.engine, 'c1', { evaluation: { work: 4 } });
  await update(ipad.engine, 'c1', { evaluation: { salary: 5 } });
  await iphone.engine.sync();
  await ipad.engine.sync();
  await iphone.engine.sync();

  assert.deepEqual(find(iphone.engine, 'c1')!.evaluation, { work: 4, salary: 5 });
  assert.deepEqual(find(ipad.engine, 'c1')!.evaluation, { work: 4, salary: 5 });
});

test('古い version を元にした更新はサーバーに拒否される（古いデータで上書きしない）', async () => {
  const server = new FakeServer();
  const iphone = await device(server, USER_A, 'iphone');
  await add(iphone.engine, company('c1', 'A社'));
  await iphone.engine.sync();
  await update(iphone.engine, 'c1', { notes: 'v2' });
  await iphone.engine.sync();

  const stale = await server.connect(USER_A).push(
    { table: 'companies', id: 'c1', op: 'update', data: { name: '古い名前' }, baseVersion: 1 }, 'old-device',
  );
  assert.equal(stale.status, 'conflict');
  assert.equal(server.table(USER_A, 'companies').get('c1')!.data.notes, 'v2');
});

test('削除と編集がぶつかったら削除を優先し、編集していた端末に通知する', async () => {
  const server = new FakeServer();
  const iphone = await device(server, USER_A, 'iphone');
  const ipad = await device(server, USER_A, 'ipad');
  await add(iphone.engine, fullCompany('c1'));
  await iphone.engine.sync();
  await ipad.engine.sync();

  await iphone.engine.mutate((d) => ({ ...d, companies: [] }));
  await update(ipad.engine, 'c1', { notes: '削除されたとは知らずに編集' });
  await iphone.engine.sync();
  await ipad.engine.sync();
  await iphone.engine.sync();

  assert.equal(list(iphone.engine).length, 0);
  assert.equal(list(ipad.engine).length, 0);
  const n = ipad.engine.getSnapshot().status.conflicts;
  assert.equal(n.length, 1);
  assert.equal(n[0].field, null);
  // 子の行（選考・振り返り・質問・タスク）もサーバー上で論理削除されている
  for (const t of ['selections', 'selection_reviews', 'interview_questions', 'tasks'] as const) {
    assert.ok([...server.table(USER_A, t).values()].every((r) => r.deleted), `${t} が削除されていない`);
  }
});

// ─── オフライン ─────────────────────────────────────

test('通信エラー中の入力は消えず、再起動後でも通信が戻れば同期される', async () => {
  const server = new FakeServer();
  const store = new MemoryStore();
  const iphone = await device(server, USER_A, 'iphone', store);
  iphone.remote.offline = true;

  await add(iphone.engine, fullCompany('c1'));
  await iphone.engine.sync();
  const st = iphone.engine.getSnapshot().status;
  assert.equal(st.phase, 'offline');
  assert.ok(st.pending > 0);
  assert.equal(list(iphone.engine).length, 1, '画面からは消えない');
  iphone.engine.dispose();

  // アプリを再起動（まだオフライン）
  const restarted = await device(server, USER_A, 'iphone', store);
  restarted.remote.offline = true;
  assert.equal(list(restarted.engine).length, 1);
  assert.ok(restarted.engine.hasPendingChanges());

  // 通信復旧 → 同期
  restarted.remote.offline = false;
  await restarted.engine.sync();
  assert.equal(restarted.engine.getSnapshot().status.pending, 0);
  const ipad = await device(server, USER_A, 'ipad');
  await ipad.engine.sync();
  assert.equal(find(ipad.engine, 'c1')?.flows[0].review?.questions[0].text, 'ガクチカ');
});

test('オフライン中に作ってすぐ消したデータは送信しない', async () => {
  const server = new FakeServer();
  const iphone = await device(server, USER_A, 'iphone');
  iphone.remote.offline = true;
  await add(iphone.engine, company('tmp', '一時的な企業'));
  await iphone.engine.mutate((d) => ({ ...d, companies: [] }));
  iphone.remote.offline = false;
  await iphone.engine.sync();
  assert.equal(iphone.remote.pushCount, 0);
  assert.equal(server.table(USER_A, 'companies').size, 0);
});

// ─── ユーザーごとの分離 ──────────────────────────────

test('ユーザーAのデータはユーザーBの端末に同期されない', async () => {
  const server = new FakeServer();
  const a = await device(server, USER_A, 'a-phone');
  const b = await device(server, USER_B, 'b-phone');
  await add(a.engine, fullCompany('c1'));
  await a.engine.sync();
  await b.engine.sync();
  assert.equal(list(b.engine).length, 0);
  // 同じ端末を2人で使っても、保存領域はユーザーごとに別
  const shared = new MemoryStore();
  const a2 = await device(server, USER_A, 'shared', shared);
  await a2.engine.sync();
  const b2 = await device(server, USER_B, 'shared', shared);
  assert.equal(list(b2.engine).length, 0);
});

test('重視度（内定比較）の設定も端末間で同期される', async () => {
  const server = new FakeServer();
  const iphone = await device(server, USER_A, 'iphone');
  const ipad = await device(server, USER_A, 'ipad');
  const w = { work: 40, salary: 20, benefits: 10, culture: 20, growth: 0, location: 10, wlb: 0, motivation: 0 };
  await iphone.engine.mutate((d) => ({ ...d, weights: w }));
  await iphone.engine.sync();
  await ipad.engine.sync();
  assert.deepEqual(ipad.engine.getSnapshot().weights, w);
});

// ─── 保存される項目の網羅 ─────────────────────────────

/**
 * 型に存在するすべての項目を埋めた企業。Required<> にしてあるので、
 * 型に項目を追加してここに足し忘れると `npm run typecheck` が失敗する。
 */
function everyField(): { company: Company; weights: AppData['weights'] } {
  const review: Required<SelectionReview> = {
    result: 'passed', date: '2026-10-08', time: '13:30', format: '対面', interviewerCount: 3,
    questions: [{ id: 'all-q1', text: '志望動機', answer: '回答内容' }, { id: 'all-q2', text: '逆質問', answer: '' }],
    answerNotes: '自分の回答', goodPoints: 'うまく答えられた', stuckPoints: '詰まった', positiveReactions: '反応が良かった',
    improvements: '改善点',
    ratings: { overall: 4, answers: 3, understanding: 5, motivation: 4, communication: 2 } satisfies Required<SelfRatings>,
    updatedAt: '2026-10-08T15:00:00.000Z',
  };
  const selection: Required<Selection> = {
    id: 'all-s1', name: '最終面接', kind: '最終面接', date: '2026-10-08', time: '13:30', online: false,
    location: '本社 5F', deadline: '2026-10-05', status: 'passed', memo: '持ち物: 履歴書',
    tasks: [{ id: 'all-t1', text: '逆質問を3つ用意', done: true }, { id: 'all-t2', text: '模擬面接', done: false }],
    review,
  };
  const company: Required<Company> = {
    id: 'all', name: '全項目株式会社', jobType: '総合職', industry: 'IT・Web', mypageUrl: 'https://example.com/mypage',
    status: 'offer', avgSalary: '600万円', employees: '3,000名', location: '東京都', founded: '1990年',
    benefits: '住宅手当', business: 'SaaS', notes: '魅力: 人', concerns: '懸念: 転勤', createdAt: '2026-09-01T00:00:00.000Z',
    evaluation: { work: 5, salary: 4, benefits: 3, culture: 5, growth: 4, location: 2, wlb: 3, motivation: 5 } satisfies Required<CompanyEvaluation>,
    motivationHistory: [
      { id: 'all_2026-09-01', date: '2026-09-01', value: 60 },
      { id: 'all_2026-10-01', date: '2026-10-01', value: 90 },
    ],
    decision: { reason: '選んだ理由', hesitation: '迷った理由', expectation: '期待すること' },
    flows: [selection],
  };
  return {
    company,
    weights: { work: 40, salary: 20, benefits: 10, culture: 20, growth: 0, location: 10, wlb: 0, motivation: 0 },
  };
}

test('iPhoneで入力したすべての項目が、iPadでそのまま復元される', async () => {
  const server = new FakeServer();
  const iphone = await device(server, USER_A, 'iphone');
  const { company: c, weights } = everyField();
  await iphone.engine.mutate(() => ({ companies: [c], weights }));
  await iphone.engine.sync();
  iphone.engine.dispose();

  // iPad で初めてログイン（端末に何も無い状態）
  const ipad = await device(server, USER_A, 'ipad');
  await ipad.engine.sync();
  assert.deepEqual(find(ipad.engine, 'all'), c);
  assert.deepEqual(ipad.engine.getSnapshot().weights, weights);
});

// ─── クラウドに保存できなかった変更 ──────────────────────

test('DBに拒否された変更は黙って端末に残らず、画面に出てログアウト時にも警告される', async () => {
  const server = new FakeServer();
  const iphone = await device(server, USER_A, 'iphone');
  await add(iphone.engine, company('ok', 'OK社'));
  await add(iphone.engine, { ...fullCompany('long'), name: 'あ'.repeat(201) });
  await iphone.engine.sync();

  const st = iphone.engine.getSnapshot().status;
  assert.equal(st.pending, 0);
  // 企業本体（制約違反）と、その子（親が無い）が「保存できなかった変更」として出る
  assert.ok(st.rejected.some((r) => r.table === 'companies' && r.rowId === 'long'));
  assert.ok(st.rejected.some((r) => r.table === 'selections'));
  assert.ok(st.rejected.every((r) => r.companyId === 'long'));
  assert.ok(iphone.engine.hasPendingChanges(), 'ログアウト時の警告対象になる');
  // 問題の無いデータは保存されている
  assert.ok(server.table(USER_A, 'companies').has('ok'));

  // 企業名を直す → 企業も子の選考・振り返りもまとめて保存される
  await update(iphone.engine, 'long', { name: '修正した企業名' });
  await iphone.engine.sync();
  assert.equal(iphone.engine.getSnapshot().status.rejected.length, 0);
  assert.equal(iphone.engine.hasPendingChanges(), false);
  const ipad = await device(server, USER_A, 'ipad');
  await ipad.engine.sync();
  assert.equal(find(ipad.engine, 'long')?.flows[0].review?.questions[0].text, 'ガクチカ');
});

test('保存できなかった変更は「クラウドの内容に戻す」で端末と他端末の表示が揃う', async () => {
  const server = new FakeServer();
  const iphone = await device(server, USER_A, 'iphone');
  await add(iphone.engine, company('c1', '元の名前'));
  await iphone.engine.sync();
  await update(iphone.engine, 'c1', { name: 'い'.repeat(201) });
  await iphone.engine.sync();
  const [r] = iphone.engine.getSnapshot().status.rejected;
  assert.equal(r.key, 'companies:c1');

  await iphone.engine.discardRejected(r.key);
  assert.equal(find(iphone.engine, 'c1')?.name, '元の名前');
  assert.equal(iphone.engine.hasPendingChanges(), false);
});
