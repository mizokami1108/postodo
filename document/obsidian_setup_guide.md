# Postodo プラグイン 動作確認ガイド

このガイドでは、開発中のPostodoプラグインをObsidianで実際に動作させる方法を説明します。

## 前提条件

- Node.js（v16以上）がインストールされている
- Obsidianがインストールされている
- GitやGitHubの基本的な知識がある

## 1. 開発環境の準備

### 1.1 依存関係のインストール

プロジェクトフォルダで以下のコマンドを実行：

```bash
# プロジェクトフォルダに移動
cd /mnt/c/Users/tapio/dev/postodo

# 依存関係をインストール
npm install
```

### 1.2 必要なファイルの確認

以下のファイルが存在することを確認：

```
postodo/
├── main.ts
├── manifest.json
├── styles.css
├── package.json
├── tsconfig.json
├── esbuild.config.mjs
└── src/
    └── （各種実装ファイル）
```

## 2. プラグインのビルド

### 2.1 開発ビルド（リアルタイム監視）

```bash
npm run dev
```

このコマンドは以下を実行します：
- TypeScriptファイルをJavaScriptにコンパイル
- ファイル変更を監視して自動再ビルド
- `main.js`ファイルを生成

### 2.2 本番ビルド

```bash
npm run build
```

リリース用の最適化されたビルドを実行します。

## 3. Obsidianへのインストール

### 3.1 Obsidianプラグインフォルダの場所

**Windows:**
```
C:\Users\[ユーザー名]\AppData\Roaming\obsidian\plugins\
```

**Mac:**
```
~/Library/Application Support/obsidian/plugins/
```

**Linux:**
```
~/.config/obsidian/plugins/
```

### 3.2 プラグインのコピー

1. Obsidianプラグインフォルダに移動
2. `postodo`フォルダを作成
3. 以下のファイルをコピー：
   - `main.js`（ビルド後に生成）
   - `manifest.json`
   - `styles.css`

```bash
# 例：Windows PowerShellの場合
mkdir "C:\Users\tapio\AppData\Roaming\obsidian\plugins\postodo"
copy main.js "C:\Users\tapio\AppData\Roaming\obsidian\plugins\postodo\"
copy manifest.json "C:\Users\tapio\AppData\Roaming\obsidian\plugins\postodo\"
copy styles.css "C:\Users\tapio\AppData\Roaming\obsidian\plugins\postodo\"
```

### 3.3 代替方法：シンボリックリンク

開発効率を上げるため、シンボリックリンクを使用することも可能：

```bash
# Windows（管理者権限が必要）
mklink /D "C:\Users\tapio\AppData\Roaming\obsidian\plugins\postodo" "C:\Users\tapio\dev\postodo"

# Mac/Linux
ln -s /path/to/postodo ~/.config/obsidian/plugins/postodo
```

## 4. Obsidianでの有効化

### 4.1 プラグインの有効化

1. Obsidianを起動
2. `設定` → `コミュニティプラグイン` → `インストール済みプラグイン`
3. `Postodo`を見つけて有効化

### 4.2 開発者モードの有効化

デバッグ情報を表示するため：

1. `設定` → `コミュニティプラグイン` → `Safe mode`をOFFに設定
2. `Restricted mode`もOFFに設定

## 5. 動作確認

### 5.1 基本機能の確認

#### プラグイン起動確認
1. リボンエリアに付箋アイコンが表示されることを確認
2. アイコンをクリックしてPostodoビューが開くことを確認

#### 付箋作成
1. 入力フィールドにテキストを入力
2. `Add Note`ボタンをクリック
3. 付箋が画面に表示されることを確認

#### 付箋操作
1. 付箋をドラッグして移動できることを確認
2. 付箋をダブルクリックして編集できることを確認
3. `×`ボタンで削除できることを確認

#### ファイル同期確認
1. Obsidianボルトで`Postodo`フォルダが作成されることを確認
2. 付箋作成時に`.md`ファイルが生成されることを確認
3. ファイルの中身がYAMLフロントマター + コンテンツの形式になっていることを確認

### 5.2 設定画面の確認

1. `設定` → `Postodo`で設定画面が開くことを確認
2. 各設定項目が正しく表示されることを確認
3. 設定変更が保存されることを確認

### 5.3 コマンドパレットの確認

1. `Ctrl+P`（Mac: `Cmd+P`）でコマンドパレットを開く
2. 以下のコマンドが表示されることを確認：
   - `Open Postodo View`
   - `Create New Note`
   - `Show All Notes`

## 6. トラブルシューティング

### 6.1 プラグインが表示されない

**原因と対処法：**
- `main.js`が正しくビルドされていない → `npm run build`を再実行
- ファイルが正しい場所にコピーされていない → パスを再確認
- Obsidianのキャッシュ問題 → Obsidianを再起動

### 6.2 コンソールエラーの確認

**開発者ツールの開き方：**
1. `Ctrl+Shift+I`（Mac: `Cmd+Option+I`）
2. Consoleタブでエラーメッセージを確認
3. エラーの詳細を確認して対処

### 6.3 よくあるエラー

#### `Cannot resolve module`
- 依存関係が不足している
- `npm install`を再実行

#### `Plugin failed to load`
- `manifest.json`の形式が間違っている
- TypeScriptのコンパイルエラー

#### `TypeError: Cannot read property`
- DIコンテナの初期化問題
- サービスの登録順序を確認

## 7. 開発時のベストプラクティス

### 7.1 開発フロー

1. `npm run dev`でファイル監視を開始
2. コードを変更
3. Obsidianで`Ctrl+R`でリロード
4. 動作確認

### 7.2 デバッグ方法

```javascript
// コンソールログの追加
console.log('Debug info:', data);

// エラーの詳細表示
try {
    // 処理
} catch (error) {
    console.error('Error details:', error);
}
```

### 7.3 設定のテスト

1. 設定画面で値を変更
2. プラグインの動作に反映されることを確認
3. Obsidianを再起動して設定が永続化されることを確認

## 8. 次のステップ

動作確認が完了したら：

1. 基本機能の安定性を確認
2. エラーハンドリングの改善
3. ユーザビリティの向上
4. テストの追加

---

## 参考情報

- [Obsidian Plugin Developer Guide](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)
- [Obsidian API Documentation](https://docs.obsidian.md/Reference/TypeScript+API)
- [esbuild Documentation](https://esbuild.github.io/)

このガイドに従って、Postodoプラグインの動作確認を行ってください。問題が発生した場合は、エラーメッセージとともに詳細な状況を記録してください。