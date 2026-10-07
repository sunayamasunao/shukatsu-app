# 就活ノート

「企業・締切を管理する」だけでなく、**就活の経験をデータとして蓄積し、次の選考と企業選びに活かす**ための就活管理アプリ（Expo / React Native + TypeScript + Supabase）。

## 主な機能

| | 機能 | 内容 |
|---|---|---|
| ① | 選考振り返り | 結果・面接日時・形式・面接官人数・聞かれた質問・回答・うまくいったこと・詰まった質問・改善点 |
| ② | **次回選考への引き継ぎ** | 前の選考の振り返りから「⚠️ 改善点 / ⭐ 反応が良かった話 / 🔄 準備し直すこと」を次の選考に自動表示 |
| ③ | 企業カルテ | 仕事内容・年収・社風など8項目を自分視点で★評価、魅力・懸念点 |
| ④ | 志望度の推移 | 日付ごとの志望度をグラフで表示 |
| ⑤ | 内定比較 | 「自分の重視度 × 自分の評価」から相性スコアを算出、意思決定メモ |
| ⑥ | 今日やること | 締切・面接と準備タスクを優先度順に表示 |
| ⑦ | 抜け漏れ検知 | 「2日後に面接なのに準備が未登録」など本当に必要なものだけ警告 |
| ⑧ | 選考フロー | ES〜最終面接・インターン等、日時・場所・形式・締切・ステータス・メモ |
| ⑨ | カレンダー | 選考の日付・締切を自動表示、タップで選考詳細へ |
| | アカウント・同期 | メール認証、iPhone / iPad 間の同期、オフライン対応、同時編集の競合検知 |

## セットアップ

```bash
cd shukatsu-app
npm install
cp .env.example .env      # Supabase の URL と Publishable key を設定
npm run check:supabase    # 開発 PC から Supabase に接続できるか確認
npx expo start -c         # -c でキャッシュを消す（.env の変更を確実に反映するため）
```

`.env` を設定しない場合は、ログインなしの**ローカル保存モード**（端末内だけに保存）で動きます。

### Supabase の準備

1. [supabase.com](https://supabase.com) でプロジェクトを作成（Region: Northeast Asia (Tokyo) 推奨）
2. SQL Editor で `supabase/migrations/20261007000000_init.sql` を1回だけ実行（または `supabase db push`）
3. `.env` に設定
   - `EXPO_PUBLIC_SUPABASE_URL` … Project Settings → Data API → Project URL
   - `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` … Project Settings → API Keys → Publishable key（`sb_publishable_...`）
   - 旧形式の anon key を使う場合は `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - **secret key / service_role key は絶対に設定しない**（設定するとアプリは起動を止め、`check:supabase` もエラーにする）
4. （任意）Authentication → Sign In / Providers → Email の「Confirm email」をオフにすると、登録後すぐにログインできます

### テスト

```bash
npm test          # 同期エンジン（2台の端末を再現）＋ DB（PGlite = WASM版Postgres で RLS を検証）
npm run typecheck
```

## 技術スタック

| 項目 | 内容 |
|------|------|
| フレームワーク | Expo SDK 57 / React Native 0.86 |
| ルーティング | Expo Router（`Stack.Protected` でログイン状態ごとに画面を出し分け） |
| 言語 | TypeScript (strict) |
| 認証 | Supabase Auth（メール + パスワード） |
| DB | Supabase (PostgreSQL) + Row Level Security |
| リアルタイム | Supabase Realtime（postgres_changes） |
| 端末内保存 | AsyncStorage（オフラインファースト） |
| テスト | node:test + PGlite |

## 設計

### 全体像

```
 画面（Company[] を扱う。既存の画面はそのまま）
   │ useCompanies()
 CompaniesContext ── SyncEngine ──┬── AsyncStorage（ユーザーごとのキー）
                                  └── Remote ── Supabase (PostgREST / Realtime)
                                                  └ PostgreSQL + RLS
```

- 画面は従来どおり入れ子の `Company[]` を扱い、`src/sync/mapping.ts` が DB の正規化された行と相互変換する。**既存画面をほぼ変えずにバックエンドを差し込める**ようにした。
- `src/sync/` は React Native に依存しない純粋な TypeScript なので、Node のテストから iPhone / iPad の2台を再現できる。

### データモデル

```
auth.users
 ├ user_settings        内定比較の重視度
 └ companies            企業（基本情報・魅力・懸念点・意思決定メモ）
    ├ company_evaluations  自分の評価 ★1〜5（1:1）
    ├ motivation_records   志望度の推移（1企業1日1件）
    └ selections           選考ステップ
       ├ selection_reviews    振り返り（1:1）
       ├ interview_questions  聞かれた質問
       └ tasks                準備タスク
```

- 全テーブル共通の列: `user_id, id, version, updated_at, updated_by, deleted`
- **主キーは `(user_id, id)`、子の外部キーも `(user_id, 親id)`**。他人の企業に自分の選考をぶら下げることが DB レベルで不可能になる。
- カレンダーのイベント・今日やること・引き継ぎは**保存せず選考データから導出**する（保存すると元データとズレる可能性があるため、データの出どころを1つにしている）。
- 意思決定メモは企業と常に一緒に編集される 1:1 のデータなので、`companies` の列として持つ。

### データの保存場所

**就活データはクラウドDB（Supabase）を正**とし、端末は「オフラインでも使うためのキャッシュ」と「未送信の変更の一時保存」として使う。

| データ | 保存先 | テーブル |
|---|---|---|
| 企業情報・魅力・懸念点・意思決定メモ | DB ⇔ 端末で同期 | `companies` |
| 自分の評価（★） | DB ⇔ 端末で同期 | `company_evaluations` |
| 志望度の履歴（最新値＝現在の志望度） | DB ⇔ 端末で同期 | `motivation_records` |
| 選考フロー・ステータス・日程・場所・メモ | DB ⇔ 端末で同期 | `selections` |
| 振り返り（結果・回答・改善点・自己評価など） | DB ⇔ 端末で同期 | `selection_reviews` |
| 面接で聞かれた質問・その回答 | DB ⇔ 端末で同期 | `interview_questions` |
| 準備タスク（完了状態を含む） | DB ⇔ 端末で同期 | `tasks` |
| 内定比較の重視度 | DB ⇔ 端末で同期 | `user_settings` |
| 今日やること・抜け漏れ・カレンダー・引き継ぎ・相性スコア | 保存しない（上のデータから毎回計算） | — |
| ダークモード | 端末のみ（端末ごとの表示設定） | — |
| ログインセッション・端末ID・同期の状態 | 端末のみ（同期の仕組み） | — |

`tests/sync.test.ts` の「すべての項目がiPadでそのまま復元される」で、型の全項目が DB を経由して復元されることを確認している（型に項目を追加してテストに足し忘れると型エラーになる）。

DB の制約（文字数上限など）に拒否された変更は、端末に黙って残さず「クラウドに保存できなかった変更」として表示し、修正またはクラウドの内容に戻すよう案内する。入力欄にも DB と同じ文字数上限を設定している。

### 同期の仕組み（オフラインファースト）

1. 編集はまず端末に保存する（`local`）。通信できなくても入力は消えない
2. 最後にサーバーから受け取った行（`base`、version 付き）との差分が「未送信の変更」
3. 同期 = **取り込み → 送信**
   - 取り込み: テーブルごとに `updated_at > 前回 - 5分` の行を取得（重なり幅でコミット順のずれによる取りこぼしを防ぐ）
   - 送信: `update … where version = 知っている version`。0件なら他端末が先に更新しているので、最新を取り込んでマージしてから送り直す
4. きっかけ: 編集の 0.8 秒後、Realtime の通知、アプリ復帰時、60秒ごと（Realtime が切れていた場合の保険）
5. 削除は論理削除（`deleted = true`）にして、他端末にも削除を伝える

### 同時編集・競合のルール

| 状況 | 結果 |
|---|---|
| 別々の項目を同時に編集（iPhone でメモ、iPad で懸念点） | 両方残る（3方向マージ） |
| 同じ項目を別の値に（iPhone 80%、iPad 90%） | 先にサーバーに届いた値を採用。もう一方の端末に「別の端末でこのデータが更新されています」と表示し、どちらにするか選べる |
| 削除と編集 | 削除を優先し、編集していた端末に通知 |
| 古い version を元にした更新 | サーバーが受け付けない（楽観的ロック）。version と updated_at は**トリガーでサーバーが決める**ので端末の時計に依存しない |
| フォームを開いている間に他端末で更新 | 保存時に「フォームで変更した項目」だけを最新に重ねる。同じ項目が変わっていれば確認ダイアログ |

### セキュリティ

- **RLS**: 全テーブルで `user_id = auth.uid()` の行だけ読み書き可能（`force row level security`）。`anon` ロールからは権限を剥奪
- `user_id` は `default auth.uid()` + RLS の `with check` で偽装不可
- 接続情報は `.env`（`EXPO_PUBLIC_*`）から読み、コードに書かない。anon key は公開前提のキーで、保護は RLS が担う。service_role key はアプリに入れない
- 通信は HTTPS（Supabase）。DB の CHECK 制約で値の範囲・文字数上限を検証
- 個人情報はメールアドレスのみ。端末 ID はランダム値（端末の識別情報は使わない）
- ログアウト時は端末内のデータを削除（未送信の変更があれば警告）。アカウント削除で全データを削除（App Store の審査要件）

### 面接で聞かれそうなこと

- **データはどこに保存？** → Supabase の PostgreSQL。端末にも AsyncStorage でキャッシュし、オフラインでも使える
- **iPhone と iPad で同期できる？** → 同じアカウントでログインすれば、Realtime で数秒以内に反映。オフライン中の変更は通信が戻れば送信
- **同時に編集したら？** → 行ごとの version による楽観的ロックと、項目単位の3方向マージ。同じ項目の衝突だけ利用者に選んでもらう
- **ユーザーごとの分離は？** → RLS と複合外部キーで DB 側が強制。アプリのバグがあっても他人のデータは返らない（`tests/db.test.ts` で検証）
- **なぜこの DB 構造？** → 企業→選考→振り返り→質問という親子関係を外部キーで保証でき、振り返りの質問を全企業横断で集計（よく聞かれた質問）しやすいため。同期の単位を行にすることで、競合の範囲を小さくできる

### 今後の拡張

- Apple / Google ログイン（Supabase Auth の OAuth。開発ビルドと各プロバイダの設定が必要）
- パスワード再設定画面
- セッショントークンの暗号化保存（expo-secure-store と組み合わせ）

## プロジェクト構成

```
shukatsu-app/
├── app/
│   ├── _layout.tsx            # ルート（認証ガード）
│   ├── login.tsx              # ログイン / 新規登録
│   ├── conflicts.tsx          # 別端末での更新の確認
│   ├── add.tsx                # 企業追加・編集
│   ├── detail/[id].tsx        # 企業カルテ
│   ├── selection/[cid]/[sid].tsx  # 選考詳細（引き継ぎ・準備タスク）
│   ├── review/[cid]/[sid].tsx     # 振り返り
│   └── (tabs)/                # ホーム / カレンダー / 内定比較 / 設定
├── src/
│   ├── context/               # Auth / Companies / Theme
│   ├── lib/supabase.ts        # Supabase クライアント
│   ├── sync/                  # 同期エンジン（schema / mapping / merge / engine / formMerge / supabaseRemote）
│   ├── components/  types/  utils/  constants.ts  theme.ts
├── supabase/migrations/       # DB スキーマ・RLS
└── tests/                     # 同期・DB のテスト
```
