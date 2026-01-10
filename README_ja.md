# Postodo - Obsidian 付箋プラグイン

[English version](README.md)

ホワイトボード風のキャンバス上で付箋を自由に配置し、Todoを視覚的に管理できるObsidianプラグインです。

![Obsidian](https://img.shields.io/badge/Obsidian-v1.0.0+-purple)
![License](https://img.shields.io/badge/license-MIT-blue)

## 特徴

- **ビジュアルキャンバス** - ホワイトボード風の背景に付箋を配置
- **ドラッグ＆ドロップ** - 付箋を自由に移動
- **ファイル同期** - 付箋はVault内にマークダウンファイルとして保存
- **双方向同期** - Obsidianからもキャンバスからも編集可能
- **外観カスタマイズ** - 6色・3サイズから選択
- **表示フィルター** - 未完了のみ、完了のみ、すべて表示
- **競合解決** - 同期競合の自動処理
- **FABメニュー** - よく使う操作への素早いアクセス

## インストール

### Obsidianコミュニティプラグインから（推奨）

1. Obsidianの設定を開く
2. コミュニティプラグイン → セーフモードを無効化
3. 「閲覧」をクリックし、「Postodo」を検索
4. 「インストール」→「有効化」

### 手動インストール

1. [最新リリース](https://github.com/your-username/postodo/releases)から `main.js`、`manifest.json`、`styles.css` をダウンロード
2. Vaultの `.obsidian/plugins/` に `postodo` フォルダを作成
3. ダウンロードしたファイルをコピー
4. Obsidianを再読み込みし、プラグインを有効化

## 使い方

1. リボンの付箋アイコンをクリック、またはコマンドパレットで「Postodo: Open」
2. 入力欄にテキストを入力してEnterで付箋を作成
3. 付箋をドラッグして移動
4. ダブルクリックで内容を編集
5. カラーパレットとサイズピッカーで外観をカスタマイズ
6. チェックボックスで完了マーク

## 設定

Obsidian設定 → Postodo から設定可能：

| 設定項目 | 説明 | デフォルト |
|----------|------|------------|
| ノートフォルダ | 付箋の保存先 | `Postodo` |
| 命名規則 | ファイル名の形式 | タイムスタンプ |
| デフォルトフィルター | 初期表示フィルター | 未完了のみ |
| 自動保存 | 自動保存の有効化 | オン |
| 保存間隔 | デバウンス時間 | 500ms |

## ファイル形式

付箋はYAMLフロントマター付きのマークダウンファイルとして保存されます：

```markdown
---
id: "unique-id"
position:
  x: 100
  y: 200
  zIndex: 1
appearance:
  color: "yellow"
  size: "medium"
completed: false
---

# ノートタイトル

ノートの内容...
```

## 開発

```bash
# 依存関係のインストール
npm install

# 開発ビルド（ウォッチモード）
npm run dev

# プロダクションビルド
npm run build

# テスト実行
npm test
```

## コントリビュート

1. リポジトリをフォーク
2. フィーチャーブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add amazing feature'`)
4. ブランチをプッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを作成

## ライセンス

MIT License - 詳細は [LICENSE](LICENSE) を参照

## サポート

- [バグ報告](https://github.com/your-username/postodo/issues)
- [機能リクエスト](https://github.com/your-username/postodo/issues)
