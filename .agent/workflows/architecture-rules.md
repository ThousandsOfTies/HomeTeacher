---
description: 重要なアーキテクチャルール - 変更前に必ず確認すること
---

# 🔒 アーキテクチャルール (Architecture Rules)

このドキュメントは**AIエージェントが修正を行う前に必ず参照すべきルール**を定義しています。

## 🚫 絶対に変更してはいけないもの (NEVER CHANGE)

以下の項目は基盤となる設定であり、変更すると本番環境が壊れる可能性があります。

### 1. API エンドポイント設定

**ファイル**: `src/services/api.ts`

```typescript
// ❌ これを変更してはいけない
const PRODUCTION_API_URL = 'https://hometeacher-api-n5ja4qrrqq-an.a.run.app'
```

**理由**: 
- この URL は Google Cloud Run にデプロイされた本番 API サーバー
- GitHub Pages からのすべての API 呼び出しがこの URL を使用
- 変更すると採点機能、解答登録機能がすべて停止する

**変更が必要な場合の正しい対応**:
- Cloud Run の新しいデプロイメントが発生した場合のみ更新
- 更新時は `deploy.yml` の `VITE_API_URL` も同時に更新

### 2. GitHub Pages デプロイ設定

**ファイル**: `.github/workflows/deploy.yml`

```yaml
# ❌ これらを安易に変更してはいけない
env:
  VITE_API_URL: https://hometeacher-api-n5ja4qrrqq-an.a.run.app
```

**理由**:
- ビルド時に環境変数として注入される
- フロントエンドのすべての API 呼び出しに影響

### 3. CORS 設定

**ファイル**: `server/index.ts`

```typescript
// ❌ origin の変更は慎重に
app.use(cors({
  origin: ['https://thousandsofties.github.io'],
  credentials: true
}))
```

**理由**:
- GitHub Pages からの API 呼び出しを許可する設定
- 変更すると CORS エラーで API 呼び出しが全失敗

---

## ✅ 変更しても良いもの (SAFE TO CHANGE)

### 1. UI/UX 関連
- コンポーネントのスタイリング
- アイコン、色、フォント
- レイアウト調整

### 2. 機能追加
- 新しいコンポーネントの追加
- 新しいフック（hooks）の追加
- 新しい API エンドポイントの追加（既存を変更しない限り）

### 3. ビジネスロジック
- 採点ロジックの改善
- プロンプトの調整
- 解答マッチングアルゴリズム

### 4. ローカル開発設定
- `.env.local` の値
- `localhost` のポート番号

---

## ⚠️ 変更時に注意が必要なもの (CHANGE WITH CAUTION)

### 1. IndexedDB スキーマ
- 既存データとの互換性を確保すること
- マイグレーション処理を実装すること

### 2. AI プロンプト
- 出力形式を変更すると、パース処理も変更が必要
- テスト後のみ本番適用

### 3. ビルド設定
- `vite.config.ts` の変更は本番ビルドに影響
- ローカルで `npm run build` を確認してから push

---

## 🔄 デプロイフロー

```
ローカル開発 → GitHub push → GitHub Actions → GitHub Pages
                                    ↓
                            VITE_API_URL が注入される
                                    ↓
                            Cloud Run API に接続
```

**重要**: 
- `localhost` への参照が本番コードに混入しないこと
- `api.ts` の `getApiBaseUrl()` は自動検出のためのフォールバック機構
- 環境変数が設定されていれば環境変数が優先される

---

## 📁 ワークスペース構造（重要）

```
HomeTeacher/                    ← メタリポジトリ（このリポジトリ）
├── .agent/workflows/           ← AIエージェント用ルール
├── .github/workflows/          ← GitHub Actions
├── repos/                      ← ⚠️ 依存リポジトリ（.gitignoreで除外）
│   ├── drawing-common/         ← 描画ライブラリ
│   └── home-teacher-core/      ← 🔴 メインアプリ（ここで作業する）
├── VERSIONS                    ← 依存リポジトリのコミットID
└── Makefile                    ← ビルド・更新コマンド
```

### ⚠️ 重要なルール

1. **`repos/` ディレクトリは .gitignore で除外されている**
   - `HomeTeacher` リポジトリには含まれない
   - 各サブリポジトリは独立したGitリポジトリ

2. **作業は必ず `repos/home-teacher-core/` で行う**
   - ❌ 別の場所にクローンして作業しない
   - ❌ `home-teacher-core-fix` のような一時フォルダを作らない

3. **VERSIONSファイルは手動で編集しない**
   - ✅ `make update-versions` を使う

---

## 📝 依存リポジトリ (home-teacher-core) の編集手順

### 1. 変更を行う

```bash
cd HomeTeacher/repos/home-teacher-core
# ファイルを編集
```

### 2. 変更をコミット＆プッシュ（home-teacher-core）

```bash
cd HomeTeacher/repos/home-teacher-core
git add .
git commit -m "説明的なコミットメッセージ"
git push origin main
```

### 3. VERSIONS を更新（HomeTeacher メタリポジトリ）

```bash
cd HomeTeacher
make update-versions
```

### 4. HomeTeacher にコミット＆プッシュ

```bash
cd HomeTeacher
git add VERSIONS
git commit -m "chore: Update home-teacher-core to [コミットID]"
git push origin main
```

### 5. GitHub Actions が自動デプロイ

push により自動的に GitHub Pages にデプロイされます。

---

## 🚫 やってはいけないこと

1. **VERSIONSファイルを手動編集しない**
   - `scripts/update-versions.sh` が `repos/` からコミットIDを取得する
   - 手動編集すると、実際のコードとVERSIONSが不一致になる

2. **`repos/` 以外の場所でサブリポジトリを編集しない**
   - `make update-versions` が正しく動作しなくなる
   - VERSIONSとの整合性が取れなくなる

3. **サブリポジトリの変更をプッシュせずにVERSIONSを更新しない**
   - ローカルのコミットIDがVERSIONSに記録されても、リモートにない

---

## 📋 修正前チェックリスト

1. [ ] この変更は「絶対に変更してはいけないもの」に該当しないか？
2. [ ] 本番環境（GitHub Pages）で動作確認できるか？
3. [ ] ローカルで `npm run build` が成功するか？
4. [ ] 既存機能を壊していないか？

---

## 🆘 よくある問題と解決策

### 問題: `localhost:3003` への接続エラー（GitHub Pages）

**原因**: API URL が環境変数から取得されていない  
**解決**: 
1. `api.ts` で `import.meta.env.VITE_API_URL` を使用しているか確認
2. `deploy.yml` で `VITE_API_URL` が設定されているか確認
3. フォールバック機構が正しく GitHub Pages を検出しているか確認

### 問題: CORS エラー

**原因**: サーバー側で GitHub Pages のオリジンが許可されていない  
**解決**: `server/index.ts` の CORS 設定を確認

---

*最終更新: 2024-12-16*
*このドキュメントはAIエージェントが参照することを想定しています*
