# Postodo プラグイン インストール手順（詳細版）

## 現在の状況確認

✅ **完了済み：**
- プロジェクトのビルドが成功
- `main.js`（158KB）が生成済み
- `manifest.json`が正しい形式
- `styles.css`が存在
- TypeScriptエラーをすべて修正

## 詳細インストール手順

### Step 1: Obsidianプラグインフォルダの確認

#### Windows の場合：
```bash
# プラグインフォルダのパス
C:\Users\tapio\AppData\Roaming\obsidian\plugins\

# フォルダの存在確認
dir "C:\Users\tapio\AppData\Roaming\obsidian\plugins\"
```

#### Mac/Linux の場合：
```bash
# プラグインフォルダのパス
~/.config/obsidian/plugins/

# フォルダの存在確認
ls -la ~/.config/obsidian/plugins/
```

### Step 2: Postodoプラグインフォルダの作成

#### Windows PowerShell:
```powershell
# プラグインフォルダを作成
mkdir "C:\Users\tapio\AppData\Roaming\obsidian\plugins\postodo"

# フォルダの存在確認
dir "C:\Users\tapio\AppData\Roaming\obsidian\plugins\postodo"
```

#### Mac/Linux:
```bash
# プラグインフォルダを作成
mkdir -p ~/.config/obsidian/plugins/postodo

# フォルダの存在確認
ls -la ~/.config/obsidian/plugins/postodo/
```

### Step 3: ファイルのコピー

#### Windows PowerShell:
```powershell
# プロジェクトディレクトリに移動
cd "C:\Users\tapio\dev\postodo"

# ファイルをコピー
copy main.js "C:\Users\tapio\AppData\Roaming\obsidian\plugins\postodo\"
copy manifest.json "C:\Users\tapio\AppData\Roaming\obsidian\plugins\postodo\"
copy styles.css "C:\Users\tapio\AppData\Roaming\obsidian\plugins\postodo\"

# コピー結果を確認
dir "C:\Users\tapio\AppData\Roaming\obsidian\plugins\postodo"
```

#### Mac/Linux:
```bash
# プロジェクトディレクトリに移動
cd ~/dev/postodo

# ファイルをコピー
cp main.js ~/.config/obsidian/plugins/postodo/
cp manifest.json ~/.config/obsidian/plugins/postodo/
cp styles.css ~/.config/obsidian/plugins/postodo/

# コピー結果を確認
ls -la ~/.config/obsidian/plugins/postodo/
```

### Step 4: Obsidianでの設定

#### 4.1 Obsidianの起動
1. Obsidianを起動
2. 任意のVault（保管庫）を開く

#### 4.2 開発者モードの有効化
1. `設定`（⚙️）をクリック
2. `コミュニティプラグイン`を選択
3. `セーフモード`を**OFF**に設定
4. `制限モード`を**OFF**に設定

#### 4.3 プラグインの有効化
1. `コミュニティプラグイン` → `インストール済みプラグイン`
2. `Postodo`を探す
3. トグルスイッチを**ON**に設定

### Step 5: エラーの確認方法

#### 5.1 開発者ツールを開く
1. `Ctrl+Shift+I`（Mac: `Cmd+Option+I`）
2. `Console`タブを選択
3. プラグインを有効化してエラーメッセージを確認

#### 5.2 よくあるエラーと対処法

**エラー1: "プラグインの読み込みに失敗しました"**
```
原因: ファイルが見つからない、または構文エラー
対処: 
- ファイルパスを再確認
- main.jsのファイルサイズを確認（0KBでないこと）
- 開発者ツールで詳細なエラーメッセージを確認
```

**エラー2: "Cannot read property 'addSettingTab' of undefined"**
```
原因: プラグインクラスの初期化エラー
対処:
- Obsidianを再起動
- プラグインファイルを再コピー
```

### Step 6: 動作確認

#### 6.1 基本機能の確認
1. **リボンアイコン**: 左側のリボンエリアに付箋アイコンが表示される
2. **コマンドパレット**: `Ctrl+P`で`Open Postodo View`が表示される
3. **設定画面**: 設定 → `Postodo`で設定項目が表示される

#### 6.2 付箋機能の確認
1. 付箋アイコンをクリックしてPostodoビューを開く
2. 入力フィールドに「テスト」と入力
3. `Add Note`ボタンをクリック
4. 黄色い付箋が表示されることを確認

### Step 7: トラブルシューティング

#### 7.1 プラグインが表示されない場合

**チェック項目:**
- [ ] プラグインフォルダが正しい場所にある
- [ ] 3つのファイル（main.js, manifest.json, styles.css）がすべて存在する
- [ ] main.jsのファイルサイズが0KBでない
- [ ] セーフモードがOFFになっている

**解決手順:**
```bash
# ファイルの存在とサイズを確認
ls -la /path/to/obsidian/plugins/postodo/

# 期待される結果:
# main.js      (約158KB)
# manifest.json (約289バイト)
# styles.css   (約3.8KB)
```

#### 7.2 プラグインが有効化できない場合

**手順:**
1. Obsidianを完全に終了
2. プラグインフォルダを一度削除
3. 新しくフォルダを作成
4. ファイルを再コピー
5. Obsidianを再起動

#### 7.3 エラーメッセージの詳細確認

**開発者ツールで確認すべき項目:**
- Console タブのエラーメッセージ
- Network タブでファイルの読み込み状況
- Sources タブでプラグインファイルの存在確認

### Step 8: 成功時の確認項目

プラグインが正常に動作している場合、以下が確認できます：

1. **コンソールログ**: `Postodo plugin loaded successfully`
2. **リボンアイコン**: 付箋アイコンが表示される
3. **コマンド**: 3つのPostodoコマンドが利用可能
4. **設定**: Postodo設定タブが表示される
5. **ビュー**: Postodoビューが正常に開く

### Step 9: 代替インストール方法（開発者向け）

#### シンボリックリンクを使用した方法

**Windows（管理者権限が必要）:**
```cmd
mklink /D "C:\Users\tapio\AppData\Roaming\obsidian\plugins\postodo" "C:\Users\tapio\dev\postodo"
```

**Mac/Linux:**
```bash
ln -s ~/dev/postodo ~/.config/obsidian/plugins/postodo
```

この方法なら、コードを変更して`npm run build`するだけで、Obsidianで即座に反映されます。

---

## 今すぐ実行できるコマンド

現在のプロジェクトディレクトリで以下を実行：

```bash
# 1. 現在のファイルを確認
ls -la main.js manifest.json styles.css

# 2. ファイルサイズを確認
stat main.js manifest.json styles.css

# 3. Windows の場合のコピーコマンド
# copy main.js "C:\Users\tapio\AppData\Roaming\obsidian\plugins\postodo\"
# copy manifest.json "C:\Users\tapio\AppData\Roaming\obsidian\plugins\postodo\"
# copy styles.css "C:\Users\tapio\AppData\Roaming\obsidian\plugins\postodo\"
```

このガイドに従って、段階的にプラグインをインストールしてください。問題が発生した場合は、具体的なエラーメッセージを教えてください。