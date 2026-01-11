# 要件定義書

## はじめに

Postodo の付箋UIを改善し、右クリックコンテキストメニューを追加します。タイトル欄を削除してシンプルな見た目にし、操作は右クリックメニューに集約します。日本語・英語の多言語対応も行います。

## 用語集

- **Context_Menu**: 付箋を右クリックした際に表示されるメニュー
- **Sticky_Note**: 付箋オブジェクト
- **Action_Bar**: 付箋下部のツールバー（チェックボックスのみ配置）
- **Tooltip**: ホバー時に表示されるファイル名情報
- **i18n**: 国際化（Internationalization）、多言語対応

## 要件

### 要件 1: タイトル欄の削除

**ユーザーストーリー:** ユーザーとして、シンプルな付箋UIを使いたい。これにより、コンテンツに集中できる。

#### 受け入れ条件

1. THE Postodo_System SHALL 付箋からタイトル入力欄を削除する
2. THE Postodo_System SHALL 付箋にコンテンツのみを表示する
3. WHEN ユーザーが付箋にホバーした場合 THEN THE Postodo_System SHALL ツールチップでファイル名を表示する

### 要件 2: アクションバーの簡素化

**ユーザーストーリー:** ユーザーとして、付箋のアクションバーをシンプルにしたい。これにより、視覚的なノイズが減る。

#### 受け入れ条件

1. THE Action_Bar SHALL チェックボックスのみを配置する
2. THE Action_Bar SHALL 削除ボタンを削除する（右クリックメニューに移動）
3. WHEN ユーザーがチェックボックスをクリックした場合 THEN THE Postodo_System SHALL 完了状態を切り替える

### 要件 3: 右クリックコンテキストメニュー

**ユーザーストーリー:** ユーザーとして、右クリックで付箋の操作メニューにアクセスしたい。これにより、様々な操作を素早く実行できる。

#### 受け入れ条件

1. WHEN ユーザーが Sticky_Note を右クリックした場合 THEN THE Postodo_System SHALL Context_Menu を表示する
2. THE Context_Menu SHALL 以下のメニュー項目を含む: ノートを開く、編集、色を変更、サイズ変更、完了/未完了、削除、ファイル名をコピー
3. WHEN ユーザーが「ノートを開く」を選択した場合 THEN THE Postodo_System SHALL 対応するマークダウンファイルを Obsidian で開く
4. WHEN ユーザーが「編集」を選択した場合 THEN THE Postodo_System SHALL 付箋の編集モードを有効にする
5. WHEN ユーザーが「色を変更」を選択した場合 THEN THE Context_Menu SHALL 色選択のサブメニューを表示する
6. WHEN ユーザーが「サイズ変更」を選択した場合 THEN THE Context_Menu SHALL サイズ選択のサブメニューを表示する
7. WHEN ユーザーが「完了にする」または「未完了に戻す」を選択した場合 THEN THE Postodo_System SHALL 完了状態を切り替える
8. WHEN ユーザーが「削除」を選択した場合 THEN THE Postodo_System SHALL 付箋を削除する
9. WHEN ユーザーが「ファイル名をコピー」を選択した場合 THEN THE Postodo_System SHALL ファイル名をクリップボードにコピーする

### 要件 4: 多言語対応（i18n）

**ユーザーストーリー:** ユーザーとして、自分の言語でUIを使いたい。これにより、操作が理解しやすくなる。

#### 受け入れ条件

1. THE Postodo_System SHALL 日本語と英語のUIテキストをサポートする
2. THE Postodo_System SHALL Obsidian の言語設定に基づいてUIテキストを切り替える
3. THE Context_Menu SHALL 現在の言語設定に応じたテキストを表示する
4. THE Action_Bar SHALL 現在の言語設定に応じたツールチップを表示する

### 要件 5: モバイル対応

**ユーザーストーリー:** ユーザーとして、モバイルデバイスでも右クリックメニューにアクセスしたい。これにより、タッチデバイスでも操作できる。

#### 受け入れ条件

1. WHEN ユーザーがモバイルデバイスで Sticky_Note を長押しした場合 THEN THE Postodo_System SHALL Context_Menu を表示する
2. THE Context_Menu SHALL タッチ操作に適したサイズで表示する
