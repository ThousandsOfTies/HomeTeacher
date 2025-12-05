# リポジトリ定義ファイル
# このプロジェクトが依存する外部リポジトリを定義

# リポジトリのクローン先ディレクトリ
REPOS_DIR := repos

# 依存リポジトリの定義
# 形式: リポジトリ名|GitHubユーザー/リポジトリ|ブランチ
# ビルド順序: 上から順に処理される
REPOSITORIES := \
	drawing-common|ThousandsOfTies/drawing-common|main \
	home-teacher-core|ThousandsOfTies/home-teacher-core|main

# リポジトリ情報を解析するヘルパー関数
define get_repo_info
$(word $(2),$(subst |, ,$(1)))
endef

# 各リポジトリの情報を取得
REPO_NAMES := $(foreach repo,$(REPOSITORIES),$(call get_repo_info,$(repo),1))
REPO_URLS := $(foreach repo,$(REPOSITORIES),https://github.com/$(call get_repo_info,$(repo),2).git)
REPO_BRANCHES := $(foreach repo,$(REPOSITORIES),$(call get_repo_info,$(repo),3))

# リポジトリのパスリスト
REPO_PATHS := $(foreach name,$(REPO_NAMES),$(REPOS_DIR)/$(name))
