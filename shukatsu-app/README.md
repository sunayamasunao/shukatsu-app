# 就活管理アプリ

Expo (React Native) + TypeScript で作った就職活動管理スマホアプリ。

## 機能

- **ホーム** — 企業リスト（締め切り順・職種別・企業名順・ステータス順に並べ替え可）
- **カレンダー** — 選考締め切りをカレンダーと一覧で確認
- **設定** — データ管理・サンプルデータ追加
- 企業の追加・編集・削除
- 選考フロー管理（ES・面接など）と締め切り日管理

## セットアップ

```bash
cd shukatsu-app
npm install
npx expo start
```

- `i` キー → iOS シミュレータ
- `a` キー → Android エミュレータ
- QR コードを Expo Go アプリで読み取る → 実機

## 技術スタック

| 項目 | 内容 |
|------|------|
| フレームワーク | Expo SDK 51 |
| ルーティング | Expo Router v3 |
| 言語 | TypeScript (strict) |
| 状態管理 | React Context API |
| データ永続化 | AsyncStorage |
| アイコン | @expo/vector-icons (Ionicons) |

## プロジェクト構成

```
shukatsu-app/
├── app/
│   ├── _layout.tsx          # ルートレイアウト
│   ├── add.tsx              # 企業追加・編集画面（モーダル）
│   ├── detail/
│   │   └── [id].tsx         # 企業詳細画面
│   └── (tabs)/
│       ├── _layout.tsx      # タブナビゲーション
│       ├── index.tsx        # ホーム（企業リスト）
│       ├── calendar.tsx     # カレンダー
│       └── settings.tsx     # 設定
└── src/
    ├── components/
    │   └── DateInput.tsx    # 日付入力コンポーネント
    ├── context/
    │   └── CompaniesContext.tsx  # 企業データ管理
    ├── theme.ts             # カラー・スペーシング定義
    ├── types/index.ts       # 型定義
    └── utils/index.ts       # ユーティリティ関数
```
