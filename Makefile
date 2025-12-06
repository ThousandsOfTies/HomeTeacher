# HomeTeacher プロジェクト Makefile
# 依存リポジトリを自動cloneして統合ビルドを行う

.PHONY: help setup clone pull install build clean dev test status

# ============================================
# リポジトリ定義
# ============================================

REPOS_DIR := repos

# 依存リポジトリ定義
# 形式: リポジトリ名|GitHubユーザー/リポジトリ|ブランチ
REPOSITORIES := \
	drawing-common|ThousandsOfTies/drawing-common|main \
	home-teacher-core|ThousandsOfTies/home-teacher-core|main

# リポジトリ情報を解析するヘルパー関数
define get_repo_info
$(word $(2),$(subst |, ,$(1)))
endef

REPO_NAMES := $(foreach repo,$(REPOSITORIES),$(call get_repo_info,$(repo),1))

# パス定義
DRAWING_COMMON := $(REPOS_DIR)/drawing-common
HOME_TEACHER_CORE := $(REPOS_DIR)/home-teacher-core

# ============================================
# カラー出力
# ============================================

GREEN  := \033[0;32m
BLUE   := \033[0;34m
YELLOW := \033[0;33m
RED    := \033[0;31m
NC     := \033[0m

.DEFAULT_GOAL := help

# ============================================
# コマンド
# ============================================

## help: ヘルプを表示
help:
	@echo "$(BLUE)HomeTeacher プロジェクト$(NC)"
	@echo ""
	@echo "$(GREEN)利用可能なコマンド:$(NC)"
	@grep -E '^## ' $(MAKEFILE_LIST) | sed 's/^## /  make /'
	@echo ""
	@echo "$(YELLOW)依存リポジトリ:$(NC)"
	@echo "  $(REPO_NAMES)"
	@echo ""

## setup: 初回セットアップ（clone + install + build）
setup: clone install build-repos
	@echo "$(GREEN)✅ セットアップ完了！$(NC)"
	@echo "$(BLUE)開発を開始するには: make dev$(NC)"

## clone: 依存リポジトリをクローン
clone:
	@echo "$(BLUE)📦 依存リポジトリをクローン中...$(NC)"
	@mkdir -p $(REPOS_DIR)
	@$(foreach repo,$(REPOSITORIES), \
		name=$(call get_repo_info,$(repo),1); \
		url=https://github.com/$(call get_repo_info,$(repo),2).git; \
		branch=$(call get_repo_info,$(repo),3); \
		if [ -d "$(REPOS_DIR)/$$name" ]; then \
			echo "$(YELLOW)⏭️  $$name は既に存在します$(NC)"; \
		else \
			echo "$(BLUE)📥 $$name をクローン中...$(NC)"; \
			git clone --branch $$branch --depth 1 $$url $(REPOS_DIR)/$$name; \
		fi; \
	)
	@echo "$(GREEN)✅ クローン完了$(NC)"

## pull: すべての依存リポジトリを最新に更新
pull:
	@echo "$(BLUE)⬇️  依存リポジトリを更新中...$(NC)"
	@$(foreach name,$(REPO_NAMES), \
		if [ -d "$(REPOS_DIR)/$(name)" ]; then \
			echo "$(BLUE)📥 $(name) を更新中...$(NC)"; \
			cd $(REPOS_DIR)/$(name) && git pull; \
		else \
			echo "$(RED)❌ $(name) が見つかりません。make clone を実行してください$(NC)"; \
		fi; \
	)
	@echo "$(GREEN)✅ 更新完了$(NC)"

## install: すべての依存関係をインストール（各リポジトリ個別）
install: clone
	@echo "$(BLUE)📦 $(DRAWING_COMMON) の依存関係をインストール中...$(NC)"
	@cd $(DRAWING_COMMON) && pnpm install --no-frozen-lockfile
	@echo "$(BLUE)📦 $(HOME_TEACHER_CORE) の依存関係をインストール中...$(NC)"
	@cd $(HOME_TEACHER_CORE) && pnpm install --no-frozen-lockfile
	@echo "$(GREEN)✅ インストール完了$(NC)"

## build-repos: 依存リポジトリをビルド（drawing-commonのみ）
build-repos:
	@echo "$(BLUE)🔨 $(DRAWING_COMMON) をビルド中...$(NC)"
	@cd $(DRAWING_COMMON) && pnpm run build
	@echo "$(GREEN)✅ 依存リポジトリのビルド完了$(NC)"

## build: すべてビルド（依存リポジトリのみ）
build: build-repos
	@echo "$(GREEN)✅ すべてのビルドが完了しました$(NC)"

## build:kids: Kids版をビルド
build\:kids:
	@echo "$(BLUE)🏠 HomeTeacher (Kids版) をビルド中...$(NC)"
	@cd $(HOME_TEACHER_CORE) && pnpm run build:kids
	@echo "$(GREEN)✅ Kids版のビルドが完了しました$(NC)"

## build:discuss: Discuss版をビルド
build\:discuss:
	@echo "$(BLUE)🏠 HomeTeacher (Discuss版) をビルド中...$(NC)"
	@cd $(HOME_TEACHER_CORE) && pnpm run build:discuss
	@echo "$(GREEN)✅ Discuss版のビルドが完了しました$(NC)"

## build:all: すべてのバージョンをビルド
build\:all:
	@echo "$(BLUE)🏠 HomeTeacher (全バージョン) をビルド中...$(NC)"
	@cd $(HOME_TEACHER_CORE) && pnpm run build:all
	@echo "$(GREEN)✅ 全バージョンのビルドが完了しました$(NC)"

## dev: 開発モードで起動
dev: clone install
	@echo "$(BLUE)🚀 開発サーバーを起動中...$(NC)"
	@cd $(HOME_TEACHER_CORE) && pnpm run dev

## dev:discuss: Discuss版を開発モードで起動
dev\:discuss: clone install
	@echo "$(BLUE)🚀 Discuss版 開発サーバーを起動中...$(NC)"
	@cd $(HOME_TEACHER_CORE) && pnpm run dev:discuss

## clean: ビルド成果物を削除（依存リポジトリは保持）
clean:
	@echo "$(YELLOW)🧹 ビルド成果物をクリーンアップ中...$(NC)"
	@$(foreach name,$(REPO_NAMES), \
		if [ -d "$(REPOS_DIR)/$(name)" ]; then \
			echo "$(YELLOW)🧹 $(name)/dist を削除中...$(NC)"; \
			rm -rf $(REPOS_DIR)/$(name)/dist $(REPOS_DIR)/$(name)/deploy; \
		fi; \
	)
	@echo "$(GREEN)✅ クリーンアップ完了$(NC)"

## clean-all: すべて削除（依存リポジトリ、node_modules含む）
clean-all:
	@echo "$(RED)🗑️  すべてを削除中...$(NC)"
	@rm -rf $(REPOS_DIR)
	@echo "$(GREEN)✅ 完全削除完了$(NC)"
	@echo "$(YELLOW)⚠️  再開するには: make setup$(NC)"

## status: すべてのリポジトリのgitステータスを表示
status:
	@echo "$(BLUE)📊 Git Status$(NC)"
	@echo ""
	@echo "$(YELLOW)HomeTeacher (メタリポジトリ):$(NC)"
	@git status -sb
	@$(foreach name,$(REPO_NAMES), \
		if [ -d "$(REPOS_DIR)/$(name)/.git" ]; then \
			echo ""; \
			echo "$(YELLOW)$(name):$(NC)"; \
			cd $(REPOS_DIR)/$(name) && git status -sb; \
		fi; \
	)

## test: テストを実行
test:
	@echo "$(BLUE)🧪 テスト実行中...$(NC)"
	@$(foreach name,$(REPO_NAMES), \
		if [ -f "$(REPOS_DIR)/$(name)/package.json" ]; then \
			echo "$(BLUE)🧪 $(name) のテスト実行中...$(NC)"; \
			cd $(REPOS_DIR)/$(name) && pnpm test || true; \
		fi; \
	)
