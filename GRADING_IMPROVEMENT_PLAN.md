# HomeTeacher 採点精度改善計画書

## 📋 概要

このドキュメントは、HomeTeacher アプリの採点精度改善のための実装計画です。
別のAI Agentに実装を依頼するためのコンテキストを提供します。

---

## 🎯 解決すべき課題

### 現状の問題

1. **図形問題の採点精度が低い**
   - 文章題は得意だが、図形問題で破綻することがある
   - AIが図形を見て計算する際にミスが発生
   - 正解なのに不正解と判定されるケースがある

2. **原因分析**
   - 現在の採点は1回のAPIコールで「読み取り→計算→判定→解説」を全て行っている
   - 図形問題は視覚的認識と空間推論が必要で、計算ミスが起きやすい
   - AIに「計算させる」のが問題の根本原因

---

## 💡 解決策: 解答参照型採点システム

### コンセプト

```
現状:
  生徒回答画像 → AI（計算+判定） → 結果
  → AIの計算ミスで破綻

改善後:
  生徒回答画像 + 正解（解答ページから取得）→ AI（比較のみ）→ 結果
  → 計算不要、比較だけなので精度向上
```

### アーキテクチャ

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         フェーズ1: 解答登録（初回のみ）                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  解答ページPDF                                                           │
│       │                                                                 │
│       ▼                                                                 │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐              │
│  │ PDFページを  │     │ Gemini API  │     │ 解答データ   │              │
│  │ 画像化       │ ──▶ │ 解答抽出    │ ──▶ │ JSON化      │              │
│  └─────────────┘     └─────────────┘     └─────────────┘              │
│                              │                   │                      │
│                              ▼                   │                      │
│                       ┌─────────────┐            │                      │
│                       │ Embedding   │            │                      │
│                       │ API         │ ← 各問題のベクトル値を計算        │
│                       └─────────────┘            │                      │
│                              │                   │                      │
│                              ▼                   ▼                      │
│                       ┌─────────────────────────────┐                  │
│                       │ IndexedDB                    │                  │
│                       │ 解答 + ベクトル値を保存       │                  │
│                       └─────────────────────────────┘                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                         フェーズ2: 採点（毎回）                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  生徒の回答画像（問題部分）                                               │
│       │                                                                 │
│       ▼                                                                 │
│  ┌─────────────────────────────────────────────┐                       │
│  │ Gemini API（ベクトル計算）                    │ ← API呼び出し①       │
│  │   Input: 問題画像                            │                       │
│  │   Output: 埋め込みベクトル                    │                       │
│  └─────────────────────────────────────────────┘                       │
│       │                                                                 │
│       ▼ ベクトル値                                                      │
│  ┌─────────────────────────────────────────────┐                       │
│  │ IndexedDB ベクトル検索                        │ ← ブラウザ内処理      │
│  │   コサイン類似度で最も近い解答を特定           │                       │
│  └─────────────────────────────────────────────┘                       │
│       │                                                                 │
│       ▼ 正解データ                                                      │
│  ┌─────────────────────────────────────────────┐                       │
│  │ Gemini API（採点）                           │ ← API呼び出し②       │
│  │   Input: 生徒回答画像 + 正解テキスト          │                       │
│  │   Task: 比較のみ（計算不要）                  │                       │
│  └─────────────────────────────────────────────┘                       │
│       │                                                                 │
│       ▼                                                                 │
│  ┌─────────────┐                                                       │
│  │ 採点結果表示 │                                                       │
│  └─────────────┘                                                       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📦 データ構造

### IndexedDB スキーマ

```typescript
// ドリル情報
interface Drill {
  id: string;                    // "drill_001"
  name: string;                  // "算数ドリル 5年生"
  totalPages: number;            // 200
  answerPageStart: number;       // 191
  answerPageEnd: number;         // 200
  createdAt: string;             // ISO date
}

// 解答データ
interface AnswerData {
  id: string;                    // "drill_001_p191_q1"
  drillId: string;               // "drill_001"
  pageNumber: number;            // 191（解答ページの番号）
  problemPageNumber: number;     // 5（問題ページの番号、わかれば）
  problemNumber: string;         // "1" or "問1" or "A"
  correctAnswer: string;         // "12cm" or "60°" など
  embedding: Float32Array;       // ベクトル値（1536次元など）← ベクトル検索用
  answerLocation?: {             // 解答の位置（オプション）
    x: number;
    y: number;
    width: number;
    height: number;
  };
}
```

---

## 🔧 実装タスク

### タスク1: 解答データのIndexedDB管理

**ファイル**: `src/utils/indexedDB.ts`（既存ファイルを拡張）

```typescript
// 追加するストア
const ANSWER_STORE = 'answers';
const DRILL_STORE = 'drills';

// 解答を保存
async function saveAnswers(drillId: string, answers: AnswerData[]): Promise<void>

// ページ番号で解答を取得
async function getAnswersByPage(drillId: string, pageNumber: number): Promise<AnswerData[]>

// ベクトル検索で最も類似した解答を取得
async function findSimilarAnswer(
  drillId: string, 
  queryEmbedding: Float32Array
): Promise<AnswerData | null>

// コサイン類似度計算（ブラウザ内）
function cosineSimilarity(vecA: Float32Array, vecB: Float32Array): number

// ドリル情報を保存
async function saveDrill(drill: Drill): Promise<void>

// ドリル一覧を取得
async function getAllDrills(): Promise<Drill[]>
```

### タスク2: 解答抽出機能

**新規ファイル**: `src/services/answerExtraction.ts`

```typescript
// 解答ページから解答を抽出するプロンプト
const EXTRACTION_PROMPT = `
You are extracting answers from an answer key page.

For each answer visible on this page:
1. Identify the problem number
2. Extract the correct answer exactly as shown
3. Note the approximate location on the page

Return ONLY valid JSON:
{
  "answers": [
    {
      "problemNumber": "1",
      "correctAnswer": "12cm",
      "location": { "x": 100, "y": 200, "width": 50, "height": 30 }
    }
  ]
}

IMPORTANT:
- Extract ALL answers visible on the page
- Preserve exact formatting (units, symbols, etc.)
- For geometry: include units (cm, °, cm², etc.)
`;

// 1ページから解答を抽出
async function extractAnswersFromPage(
  imageData: string, 
  pageNumber: number
): Promise<AnswerData[]>

// 複数ページを順番に処理
async function extractAnswersFromPages(
  pdfFile: File,
  startPage: number,
  endPage: number,
  onProgress?: (current: number, total: number) => void
): Promise<AnswerData[]>
```

### タスク3: 採点プロンプトの修正

**ファイル**: `server/index.ts`（199行目〜のプロンプトを修正）

```typescript
// 正解がある場合の採点プロンプト
const GRADING_WITH_ANSWER_PROMPT = `
You are grading a student's work. The correct answer is provided.

CORRECT ANSWER: ${correctAnswer}

YOUR TASK:
1. Read the student's handwritten answer from the image
2. Compare with the correct answer above
3. Determine if they match (consider equivalent expressions)

For geometry problems:
- "12cm" and "12 cm" are equivalent
- "60°" and "60度" are equivalent
- Slight variations in notation are acceptable if mathematically equivalent

Return JSON:
{
  "problems": [{
    "problemNumber": "${problemNumber}",
    "studentAnswer": "what the student wrote",
    "isCorrect": true/false,
    "correctAnswer": "${correctAnswer}",
    "feedback": "encouraging comment",
    "explanation": "brief explanation of why correct/incorrect"
  }],
  "overallComment": "overall feedback"
}

LANGUAGE: ${responseLang}
`;
```

### タスク4: UI実装

**解答ページ選択ダイアログ**

```typescript
// コンポーネント: src/components/admin/AnswerPageSelector.tsx

interface AnswerPageSelectorProps {
  totalPages: number;
  onSelect: (startPage: number, endPage: number) => void;
}

// 機能:
// - 「解答ページの範囲を選択」ダイアログ
// - startPage, endPage のスライダー or 数値入力
// - プレビュー表示（オプション）
```

**解答登録プログレス表示**

```typescript
// コンポーネント: src/components/admin/AnswerExtractionProgress.tsx

interface Props {
  currentPage: number;
  totalPages: number;
  status: 'processing' | 'done' | 'error';
}

// 機能:
// - 「解答を抽出中... 3/10 ページ」
// - プログレスバー
// - 完了/エラー通知
```

---

## ⏱️ 性能見積もり

### 解答登録（1回のみ）

| ステップ | 時間 |
|---------|------|
| PDF → 画像化 | 100ms/ページ |
| Gemini API（解答抽出） | 2〜4秒/ページ |
| IndexedDB保存 | 10ms/ページ |
| **合計（10ページ）** | **20〜40秒** |

### 採点（毎回）

| ステップ | 時間 |
|---------|------|
| Gemini Embedding API（ベクトル計算）| 200〜500ms |
| IndexedDB ベクトル検索 | 1〜10ms |
| Gemini API（比較のみ） | 1〜2秒 |
| **合計** | **1.5〜2.5秒** |

**現状（2〜5秒）と同等〜やや高速化 + 精度大幅向上**

---

## 💰 コスト見積もり

### 使用モデル

- **解答抽出**: Gemini 2.5 Flash（安価）
- **採点**: Gemini 2.5 Flash（安価）

### 月間コスト

```
解答登録: 4ドリル × 1円 = 4円
採点: 300問 × 0.04円 = 12円
合計: 約16円/月
```

---

## 📋 実装チェックリスト

- [ ] IndexedDB スキーマ拡張（answers, drills ストア追加、embeddingフィールド対応）
- [ ] 解答抽出サービス実装（Embedding API呼び出し含む）
- [ ] コサイン類似度によるベクトル検索実装
- [ ] 解答ページ選択UI
- [ ] 解答登録プログレス表示
- [ ] 採点時のEmbedding取得処理
- [ ] 採点プロンプト修正（正解参照モード）
- [ ] API側で正解を受け取る処理追加
- [ ] テスト（図形問題で精度検証）

---

## 📁 既存コードの参照

### 関連ファイル

- `src/utils/indexedDB.ts` - IndexedDB操作（拡張対象）
- `src/services/api.ts` - 採点APIクライアント
- `server/index.ts` - 採点サーバー（プロンプト修正対象）
- `src/components/admin/AdminPanel.tsx` - 管理画面（UI追加対象）
- `src/components/grading/GradingResult.tsx` - 採点結果表示

### 現在の採点プロンプト

`server/index.ts` の199〜235行目を参照。
これを「正解がある場合」と「正解がない場合（従来）」で分岐させる。

---

## ⚠️ 注意事項

1. **50MB PDFを丸ごと送らない**
   - 解答ページだけ抽出して1ページずつAPI送信
   - バックグラウンドで処理

2. **Safari/iOS の制約**
   - 7日間アクセスがないとIndexedDBデータ削除の可能性
   - PWAとしてインストールすれば回避可能

3. **レート制限**
   - ページ間に500msのディレイを入れる
   - 連続リクエストでAPIエラーを防ぐ

---

## 🎯 期待効果

1. **図形問題の採点精度向上** - 計算ミスを排除
2. **レスポンス高速化** - 50%短縮
3. **コスト最小** - 月額約16円
4. **ユーザー体験向上** - 正確な採点で学習効果アップ
