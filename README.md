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

## 📦 Deployment

### GitHub Pages (Frontend)

**Live URLs:**
- Kids version: https://thousandsofties.github.io/HomeTeacher/
- Discuss version: https://thousandsofties.github.io/HomeTeacher/discuss/

**Deployment methods:**

1. **Manual deployment** (current):
   ```bash
   npm run deploy
   ```

2. **Automated deployment** (GitHub Actions):
   - Automatically deploys on push to `main` branch
   - Requires GitHub Actions to be enabled

For detailed deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md) or [GITHUB_PAGES_SETUP.md](GITHUB_PAGES_SETUP.md).

### PWA Features

TutoTuto is a Progressive Web App with:
- **Offline support** via Service Worker caching
- **Installable** - Add to home screen on mobile/desktop
- **Auto-updates** - New versions load automatically
- **Fast loading** - Optimized chunks and caching

## 🛠️ Technology Stack

- **Framework**: React 18 + TypeScript
- **Build tool**: Vite
- **Canvas library**: Fabric.js
- **PDF rendering**: PDF.js
- **AI**: Google Gemini API
- **PWA**: vite-plugin-pwa (Workbox)
- **Deployment**: GitHub Pages (GitHub Actions)
