# Postodo プラグイン トラブルシューティングガイド

## 「プラグインの読み込みに失敗しました」エラーの解決方法

### 1. 基本的なチェック項目

#### 1.1 必要ファイルの確認
Obsidianプラグインフォルダに以下のファイルが存在することを確認：

```
Obsidian/plugins/postodo/
├── main.js        # ビルドされたメインファイル
├── manifest.json  # プラグイン情報
└── styles.css     # スタイルシート
```

#### 1.2 ファイルサイズの確認
- `main.js` のファイルサイズが 0KB でないこと
- `manifest.json` が正しいJSON形式であること

```bash
# ファイルサイズ確認
ls -la /path/to/obsidian/plugins/postodo/

# JSONファイルの構文チェック
cat manifest.json | jq '.'
```

### 2. 詳細なエラー確認方法

#### 2.1 開発者ツールでのエラー確認

1. Obsidianを開く
2. `Ctrl+Shift+I` (Mac: `Cmd+Option+I`) で開発者ツールを開く
3. `Console` タブを選択
4. プラグインを有効化しようとして、エラーメッセージを確認

#### 2.2 よくあるエラーメッセージとその意味

**エラー例1:**
```
TypeError: Cannot read property 'addSettingTab' of undefined
```
→ プラグインクラスの初期化エラー

**エラー例2:**
```
SyntaxError: Unexpected token
```
→ JavaScriptファイルの構文エラー

**エラー例3:**
```
Module not found: obsidian
```
→ Obsidian APIの参照エラー

### 3. 段階的な修正手順

#### 3.1 最新のビルドを確認

```bash
# プロジェクトディレクトリで実行
cd /mnt/c/Users/tapio/dev/postodo

# 依存関係を再インストール
npm install

# クリーンビルド
rm -f main.js
npm run build

# ビルド結果を確認
ls -la main.js
```

#### 3.2 最小限のテストプラグインで確認

デバッグ用の最小限のプラグインを作成してテスト：

```javascript
// test-main.js
const { Plugin } = require('obsidian');

class TestPlugin extends Plugin {
    onload() {
        console.log('Test plugin loaded');
    }
    
    onunload() {
        console.log('Test plugin unloaded');
    }
}

module.exports = TestPlugin;
```

#### 3.3 プラグインファイルの配置確認

**Windows:**
```bash
# プラグインフォルダのパス
C:\Users\[USERNAME]\AppData\Roaming\obsidian\plugins\postodo\

# ファイルコピー
copy main.js "C:\Users\tapio\AppData\Roaming\obsidian\plugins\postodo\"
copy manifest.json "C:\Users\tapio\AppData\Roaming\obsidian\plugins\postodo\"
copy styles.css "C:\Users\tapio\AppData\Roaming\obsidian\plugins\postodo\"
```

**Mac:**
```bash
# プラグインフォルダのパス
~/Library/Application Support/obsidian/plugins/postodo/

# ファイルコピー
cp main.js ~/Library/Application\ Support/obsidian/plugins/postodo/
cp manifest.json ~/Library/Application\ Support/obsidian/plugins/postodo/
cp styles.css ~/Library/Application\ Support/obsidian/plugins/postodo/
```

### 4. より詳細なデバッグ手順

#### 4.1 ログレベルの設定

`main.js` に以下のデバッグコードを追加：

```javascript
// デバッグ用ログ
console.log('Postodo plugin loading...');

// エラーハンドリングの追加
try {
    // プラグインの初期化コード
} catch (error) {
    console.error('Plugin initialization error:', error);
    console.error('Error stack:', error.stack);
}
```

#### 4.2 段階的な機能有効化

プラグインの機能を段階的に有効化してどこでエラーが発生するかを特定：

1. 基本的なプラグインクラスのみ
2. DIコンテナの追加
3. ビューの追加
4. 設定の追加

### 5. 環境固有の問題

#### 5.1 パス区切り文字の問題
WindowsとmacOS/Linuxでパス区切り文字が異なる場合：

```javascript
// 修正前
const path = 'Postodo/note.md';

// 修正後
const path = require('path');
const notePath = path.join('Postodo', 'note.md');
```

#### 5.2 権限の問題
ファイルの読み書き権限を確認：

```bash
# Windows
icacls "C:\Users\tapio\AppData\Roaming\obsidian\plugins\postodo"

# Mac/Linux
ls -la ~/Library/Application\ Support/obsidian/plugins/postodo/
```

### 6. 代替的なデバッグ方法

#### 6.1 Obsidianの再起動
プラグインファイルを更新後、Obsidianを完全に再起動：

1. Obsidianを終了
2. プロセスが完全に終了していることを確認
3. Obsidianを再起動

#### 6.2 プラグインフォルダの初期化
```bash
# 既存のプラグインフォルダを削除
rm -rf /path/to/obsidian/plugins/postodo

# 新しいフォルダを作成
mkdir /path/to/obsidian/plugins/postodo

# ファイルを再配置
```

### 7. 修正済みファイルの確認

現在のプロジェクトで修正済みの内容：

1. ✅ TypeScriptコンパイルエラーの修正
2. ✅ 設定タブの型エラー修正
3. ✅ null参照エラーの修正
4. ✅ ビルドプロセスの最適化

### 8. 最終確認手順

```bash
# 1. プロジェクトのビルド
npm run build

# 2. ファイルの存在確認
ls -la main.js manifest.json styles.css

# 3. main.jsの内容確認（先頭部分）
head -20 main.js

# 4. Obsidianプラグインフォルダへのコピー
cp main.js manifest.json styles.css /path/to/obsidian/plugins/postodo/

# 5. Obsidianの再起動
```

### 9. 問題が解決しない場合

以下の情報を収集して詳細な診断を行う：

1. **Obsidianのバージョン**
2. **OSとバージョン**
3. **開発者ツールの完全なエラーメッセージ**
4. **`main.js`のファイルサイズ**
5. **他のプラグインとの競合の有無**

```bash
# 診断情報の収集
echo "=== Obsidian Plugin Debug Info ==="
echo "OS: $(uname -a)"
echo "Node.js: $(node --version)"
echo "NPM: $(npm --version)"
echo "Main.js size: $(stat -f%z main.js 2>/dev/null || stat -c%s main.js 2>/dev/null)"
echo "Files in plugin folder:"
ls -la /path/to/obsidian/plugins/postodo/
```

このガイドに従って段階的に問題を解決してください。