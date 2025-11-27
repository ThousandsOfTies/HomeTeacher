# TutoTuto

AI-powered learning support app with handwriting and PDF annotation features.

## 🎯 Versions

TutoTuto is available in two versions:

### 📚 TutoTuto (Kids Version)
For elementary school students with AI grading and SNS rewards.

**[Launch TutoTuto →](https://thousandsofties.github.io/HomeTeacher/)**

### 💼 TutoTuto Discuss (Adult Version)
For university students and professionals focused on note-taking and discussion.

**[Launch TutoTuto Discuss →](https://thousandsofties.github.io/HomeTeacher/discuss/)**

## ✨ Features

- 📝 **PDF Annotation**: Write directly on PDF files with Apple Pencil
- 🔄 **Scratch to Erase**: Scribble over lines to erase them
- ✅ **AI Grading** (Kids version only): Automatic homework grading
- 🎮 **SNS Rewards** (Kids version only): Unlock social media after completing work
- 💾 **Auto-save**: All your annotations are saved automatically
- 📱 **PWA Support**: Install as a standalone app on your device

## 🚀 Development

```bash
# Install dependencies
npm install

# Run Kids version (development)
npm run dev

# Run Discuss version (development)
npm run dev:discuss

# Build both versions
npm run build:all

# Build Kids version only
npm run build:kids

# Build Discuss version only
npm run build:discuss
```

## 🏗️ Architecture

This project uses a single codebase with environment-based feature flags:

- **Kids version** (`/HomeTeacher/`): Includes AI grading and SNS features
- **Discuss version** (`/HomeTeacher/discuss/`): Clean interface for adults

Feature flags are controlled in `src/config/features.ts` using environment variables.
