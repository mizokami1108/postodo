# Postodo プラグイン クイックテストガイド

## 🚀 今すぐテストする手順

### 1. ファイルの準備確認
```bash
# 現在のディレクトリ確認
pwd
# 結果: /mnt/c/Users/tapio/dev/postodo

# 必要ファイルの確認
ls -la main.js manifest.json styles.css
# 結果: 
# main.js      (39KB)
# manifest.json (289バイト)
# styles.css   (3.8KB)
```

### 2. Obsidianプラグインフォルダへのコピー

#### Windows PowerShell で実行：
```powershell
# プラグインフォルダを作成
mkdir "C:\Users\tapio\AppData\Roaming\obsidian\plugins\postodo" -Force

# ファイルをコピー
copy main.js "C:\Users\tapio\AppData\Roaming\obsidian\plugins\postodo\"
copy manifest.json "C:\Users\tapio\AppData\Roaming\obsidian\plugins\postodo\"
copy styles.css "C:\Users\tapio\AppData\Roaming\obsidian\plugins\postodo\"

# コピー結果を確認
dir "C:\Users\tapio\AppData\Roaming\obsidian\plugins\postodo"
```

#### Mac/Linux で実行：
```bash
# プラグインフォルダを作成
mkdir -p ~/.config/obsidian/plugins/postodo

# ファイルをコピー
cp main.js ~/.config/obsidian/plugins/postodo/
cp manifest.json ~/.config/obsidian/plugins/postodo/
cp styles.css ~/.config/obsidian/plugins/postodo/

# コピー結果を確認
ls -la ~/.config/obsidian/plugins/postodo/
```

### 3. Obsidianでの有効化手順

1. **Obsidianを起動**
2. **設定を開く**: ⚙️ 設定ボタンをクリック
3. **コミュニティプラグインを選択**
4. **セーフモードをOFF**にする
5. **制限モードをOFF**にする
6. **インストール済みプラグイン**タブを選択
7. **「Postodo」を見つけて有効化**

### 4. 動作確認のチェックポイント

#### 4.1 基本的な表示確認
- [ ] 左側のリボンエリアに**付箋アイコン**が表示される
- [ ] 設定メニューに**「Postodo」**項目が表示される

#### 4.2 コンソールログの確認
1. `Ctrl+Shift+I`（Mac: `Cmd+Option+I`）で開発者ツールを開く
2. `Console`タブを選択
3. 以下のログが表示されることを確認：
   ```
   PostodoMainPlugin: Starting onload
   Postodo plugin loaded successfully
   PostodoMainPlugin: onload completed successfully
   ```

#### 4.3 機能テスト
1. **付箋アイコンをクリック**してPostodoビューを開く
2. **入力フィールドに「テスト」**と入力
3. **「Add Note」ボタン**をクリック
4. **黄色い付箋が画面に表示**されることを確認

### 5. トラブルシューティング

#### 5.1 プラグインが表示されない場合
**確認事項：**
- [ ] ファイルが正しい場所にコピーされている
- [ ] 3つのファイルすべてが存在する
- [ ] セーフモードがOFFになっている

**解決方法：**
```bash
# ファイルの存在確認
ls -la "C:\Users\tapio\AppData\Roaming\obsidian\plugins\postodo"

# または Mac/Linux
ls -la ~/.config/obsidian/plugins/postodo/
```

#### 5.2 「読み込みに失敗しました」エラー
**確認事項：**
- main.jsファイルが0KBでないこと
- 開発者ツールのConsoleでエラーメッセージを確認

**解決方法：**
1. Obsidianを完全に終了
2. プラグインフォルダを再作成
3. ファイルを再コピー
4. Obsidianを再起動

#### 5.3 コンソールにエラーが表示される場合
**よくあるエラー：**
```javascript
// エラー例1: モジュールが見つからない
ModuleNotFoundError: Cannot resolve module 'obsidian'
→ 解決: npm run build を再実行

// エラー例2: DIコンテナエラー
Error: Service not registered: EventBus
→ 解決: プラグインを無効化→有効化

// エラー例3: ファイル権限エラー
Error: EACCES: permission denied
→ 解決: ファイルの権限を確認
```

### 6. 成功時の期待される動作

#### 6.1 プラグイン読み込み成功時
- リボンに付箋アイコンが表示
- コンソールに成功ログが表示
- 設定にPostodo項目が表示

#### 6.2 付箋作成成功時
- 入力フィールドに入力後、Add Noteで付箋作成
- 黄色い付箋が画面に表示
- 付箋をドラッグして移動可能
- ダブルクリックで編集可能

#### 6.3 ファイル同期成功時
- Obsidianボルトに「Postodo」フォルダが作成
- 付箋作成時に`.md`ファイルが生成
- ファイル内容がYAMLフロントマター形式

### 7. 追加のデバッグ情報

#### 7.1 コンソールでの動作確認
開発者ツールのConsoleで以下を実行：
```javascript
// プラグインの存在確認
app.plugins.plugins.postodo

// 設定の確認
app.plugins.plugins.postodo.settings

// DIコンテナの確認
app.plugins.plugins.postodo.container
```

#### 7.2 ファイル内容の確認
```bash
# main.jsの末尾確認
tail -5 main.js
# 期待される結果: module.exports = PostodoMainPlugin;

# manifest.jsonの確認
cat manifest.json
# 期待される結果: 正しいJSON形式
```

### 8. 今すぐ実行すべきコマンド

```bash
# 1. プロジェクトディレクトリにいることを確認
pwd

# 2. 必要ファイルの確認
ls -la main.js manifest.json styles.css

# 3. Windows の場合（PowerShellで実行）
mkdir "C:\Users\tapio\AppData\Roaming\obsidian\plugins\postodo" -Force
copy main.js "C:\Users\tapio\AppData\Roaming\obsidian\plugins\postodo\"
copy manifest.json "C:\Users\tapio\AppData\Roaming\obsidian\plugins\postodo\"
copy styles.css "C:\Users\tapio\AppData\Roaming\obsidian\plugins\postodo\"

# 4. Obsidianを起動してプラグインを有効化

# 5. 開発者ツールを開いてコンソールログを確認
```

このガイドに従って、プラグインが正常に動作することを確認してください。問題が発生した場合は、具体的なエラーメッセージとともにお知らせください。