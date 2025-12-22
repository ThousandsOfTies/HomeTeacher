---
description: コマンド実行のルール - ファイル操作やシェルコマンド実行時に必ず参照
---

# 🖥️ コマンド実行ルール (Command Execution Rules)

このドキュメントはAIエージェントがコマンドやファイル操作を行う際のルールを定義しています。

## 🔧 作業環境

| 項目 | 値 |
|------|-----|
| **OS** | Windows 11 |
| **デフォルトシェル** | PowerShell |
| **WSL** | Ubuntu 24.04.2 LTS (WSL 2) ✅ 利用可能 |

---

## ✅ 推奨: WSL経由でのコマンド実行

**ファイル内容の読み取り・編集**、**Unix系コマンド**を使う場合はWSL経由を推奨します。

### 基本形式
```powershell
wsl bash -c "コマンド"
```

### パス変換ルール
| Windows | WSL |
|---------|-----|
| `C:\VibeCode\HomeTeacher` | `/mnt/c/VibeCode/HomeTeacher` |
| `C:\Users\yasuchika` | `/mnt/c/Users/yasuchika` |

### 例: ファイル操作
```powershell
# ファイル内容を読む（文字化けなし）
wsl bash -c "head -50 /mnt/c/VibeCode/HomeTeacher/repos/home-teacher-core/src/App.tsx"

# ファイルを検索
wsl bash -c "grep -r 'useDrawing' /mnt/c/VibeCode/HomeTeacher/repos/home-teacher-core/src/"

# ファイルを編集（sed）
wsl bash -c "sed -i 's/old/new/g' /mnt/c/VibeCode/HomeTeacher/repos/file.ts"
```

### 例: Git操作
```powershell
wsl bash -c "cd /mnt/c/VibeCode/HomeTeacher && git status"
wsl bash -c "cd /mnt/c/VibeCode/HomeTeacher && git add . && git commit -m 'message'"
```

### 例: npm/node
```powershell
wsl bash -c "cd /mnt/c/VibeCode/HomeTeacher/repos/home-teacher-core && npm run build"
```

---

## ⚠️ PowerShell直接実行が必要なケース

以下の場合はPowerShellを直接使用します：

1. **Windows固有のツール** (gcloud, docker-desktopなど)
2. **WSL関連コマンド** (`wsl --list` など)
3. **ファイル書き込み** (Out-File, Set-Content) - ただし文字化けに注意

---

## 🚫 避けるべきパターン

### PowerShellでのファイル読み取り
```powershell
# ❌ 日本語が文字化けする可能性
Get-Content "file.tsx" -Encoding UTF8

# ✅ WSL経由で読む
wsl bash -c "cat /mnt/c/.../file.tsx"
```

### PowerShellでのテキスト置換
```powershell
# ❌ 複雑な正規表現が動作しにくい
$content -replace "pattern", "replacement"

# ✅ WSL経由でsedを使う
wsl bash -c "sed -i 's/pattern/replacement/g' /mnt/c/.../file.ts"
```

---

## 📝 ファイル編集のベストプラクティス

### 1. 小さな変更（1-2箇所）
```powershell
# sedで直接置換
wsl bash -c "sed -i 's/oldText/newText/g' /mnt/c/.../file.ts"
```

### 2. 複数箇所の変更
```powershell
# 一時ファイルにパッチを作成して適用
# または、ファイル全体を読み込み→編集→書き戻し
```

### 3. 新規ファイル作成
```powershell
# write_to_file ツールを使用（最も安全）
# または
wsl bash -c "cat > /mnt/c/.../newfile.ts << 'EOF'
ファイル内容
EOF"
```

---

## 🔄 ビルド・デプロイ

### ローカルビルド
```powershell
wsl bash -c "cd /mnt/c/VibeCode/HomeTeacher/repos/home-teacher-core && npm run build"
```

### drawing-common ビルド
```powershell
wsl bash -c "cd /mnt/c/VibeCode/HomeTeacher/repos/drawing-common && npm run build"
```

### Cloud Run デプロイ (PowerShellで実行)
```powershell
gcloud run deploy hometeacher-api --source . --region asia-northeast1
```

---

## 📋 チェックリスト

コマンド実行前に確認：

1. [ ] ファイル読み取りはWSL経由か？
2. [ ] パスは正しく変換されているか？（`C:\` → `/mnt/c/`）
3. [ ] 日本語を含むファイルの操作はWSL経由か？
4. [ ] Windows専用ツール（gcloud等）はPowerShellで実行か？

---

*最終更新: 2024-12-22*
*このドキュメントはAIエージェントが参照することを想定しています*
