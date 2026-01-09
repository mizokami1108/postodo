# 要件定義書

## はじめに

Postodo は Obsidian プラグインとして動作する付箋 Todo アプリケーションです。ホワイトボード風の背景に付箋を自由に配置し、直感的な操作で Todo を管理できます。付箋の内容は Obsidian Vault 内の `Postodo` フォルダにマークダウンファイルとして保存され、双方向同期により Obsidian エコシステムとの統合を実現します。

## 用語集

- **Postodo_System**: 付箋 Todo アプリケーション全体のシステム
- **Sticky_Note**: 付箋オブジェクト。タイトル、本文、位置、サイズ、色、完了状態を持つ
- **Canvas**: 付箋を配置するホワイトボード風の背景領域
- **Postodo_Folder**: Obsidian Vault 内の `Postodo` フォルダ。全ての付箋データファイルを格納
- **Note_File**: Postodo_Folder 内に保存される付箋データのマークダウンファイル
- **Display_Filter**: Canvas 上の Sticky_Note 表示フィルター。未完了のみ、完了のみ、すべて表示の3種類
- **FAB_Menu**: Floating Action Button メニュー。右下に配置される操作メニュー
- **DI_Container**: 依存性注入コンテナ。サービスの登録と解決を管理
- **Event_Bus**: コンポーネント間の疎結合な通信を実現するイベントシステム
- **Naming_Strategy**: Note_File のファイル名生成戦略。デフォルトは `Sticky-yyyyMMddHHmmss` 形式
- **Sync_Manager**: ファイルと UI 間のデータ同期を管理するコンポーネント
- **Conflict_Resolver**: ファイルと UI の競合を検出・解決するコンポーネント

## 要件

### 要件 1: 付箋の作成

**ユーザーストーリー:** ユーザーとして、キャンバス上に付箋を作成したい。これにより、Todoを視覚的に整理できる。

#### 受け入れ条件

1. WHEN ユーザーが Canvas の空白領域をクリックした場合 THEN THE Postodo_System SHALL クリック位置に新しい Sticky_Note を作成する
2. WHEN ユーザーが入力フォームにテキストを入力し Enter キーまたは追加ボタンを押した場合 THEN THE Postodo_System SHALL 入力内容を持つ新しい Sticky_Note を作成する
3. WHEN 新しい Sticky_Note が作成された場合 THEN THE Postodo_System SHALL Postodo_Folder 内に対応する Note_File を自動作成する
4. WHEN 新しい Sticky_Note が作成された場合 THEN THE Postodo_System SHALL 一意の識別子、作成日時、デフォルトの外観プロパティを割り当てる
5. WHEN ユーザーが空のコンテンツで Sticky_Note を作成しようとした場合 THEN THE Postodo_System SHALL 作成を防止し現在の状態を維持する
6. WHEN Note_File が作成される際にファイル名が指定されていない場合 THEN THE Postodo_System SHALL Naming_Strategy に基づいてファイル名を自動生成する
7. THE Postodo_System SHALL デフォルトの Naming_Strategy として `Sticky-yyyyMMddHHmmss` 形式を使用する

### 要件 2: 付箋の編集

**ユーザーストーリー:** ユーザーとして、付箋の内容を編集したい。これにより、必要に応じてTodoを更新できる。

#### 受け入れ条件

1. WHEN ユーザーが Sticky_Note をダブルクリックした場合 THEN THE Postodo_System SHALL その付箋の編集モードを有効にする
2. WHEN ユーザーが Sticky_Note の内容を変更した場合 THEN THE Postodo_System SHALL 500ms 以内に対応する Note_File を更新する
3. WHEN Note_File が外部で変更された場合 THEN THE Postodo_System SHALL 対応する Sticky_Note の表示を更新する
4. WHILE 編集モードがアクティブな間 THE Postodo_System SHALL 青いボーダーハイライトで視覚的フィードバックを提供する
5. WHEN ユーザーが Sticky_Note のタイトルを変更した場合 THEN THE Postodo_System SHALL 対応する Note_File のファイル名を変更する
6. THE Postodo_System SHALL Sticky_Note のタイトルと本文を別々に編集可能にする

### 要件 3: 付箋の移動

**ユーザーストーリー:** ユーザーとして、付箋をドラッグ&ドロップで移動したい。これにより、キャンバス上で空間的に整理できる。

#### 受け入れ条件

1. WHEN ユーザーが Sticky_Note をドラッグした場合 THEN THE Postodo_System SHALL カーソル位置に追従して付箋を移動する
2. WHILE Sticky_Note がドラッグ中の間 THE Postodo_System SHALL 拡大とシャドウ強化による視覚的フィードバックを表示する
3. WHEN ドラッグ操作が完了した場合 THEN THE Postodo_System SHALL 新しい位置を Note_File に永続化する
4. WHEN ユーザーが Sticky_Note を Canvas の境界外にドラッグしようとした場合 THEN THE Postodo_System SHALL 付箋の位置を表示可能な範囲内に制限する
5. WHEN ユーザーが Sticky_Note 内のテキスト入力またはボタン領域をクリックした場合 THEN THE Postodo_System SHALL ドラッグ操作を開始しない

### 要件 4: 付箋の完了と非表示

**ユーザーストーリー:** ユーザーとして、付箋を完了としてマークしたい。これにより、進捗を追跡し完了したアイテムを非表示にできる。

#### 受け入れ条件

1. WHEN ユーザーが Sticky_Note を完了としてマークした場合 THEN THE Postodo_System SHALL Note_File の完了ステータスを更新する
2. WHEN Sticky_Note の完了ステータスが true に変更された場合 THEN THE Postodo_System SHALL 現在の Display_Filter に基づいて表示/非表示を決定する
3. WHEN Sticky_Note の完了ステータスが false に変更された場合 THEN THE Postodo_System SHALL 現在の Display_Filter に基づいて表示/非表示を決定する
4. WHEN Note_File から完了ステータスが切り替えられた場合 THEN THE Postodo_System SHALL Canvas 表示に変更を反映する
5. THE Postodo_System SHALL 3つの Display_Filter オプションを提供する: 未完了のみ表示、完了のみ表示、すべて表示
6. WHEN ユーザーが Display_Filter を変更した場合 THEN THE Postodo_System SHALL 即座に Canvas 上の Sticky_Note 表示を更新する
7. THE Postodo_System SHALL デフォルトの Display_Filter として「未完了のみ表示」を使用する

### 要件 5: 付箋の削除

**ユーザーストーリー:** ユーザーとして、付箋を削除したい。これにより、不要になったアイテムを削除できる。

#### 受け入れ条件

1. WHEN ユーザーが Sticky_Note の削除ボタンをクリックした場合 THEN THE Postodo_System SHALL 回転縮小アニメーションで付箋を削除する
2. WHEN Sticky_Note が削除された場合 THEN THE Postodo_System SHALL Postodo_Folder から対応する Note_File を削除する
3. WHEN ユーザーが FAB_Menu から全ての Sticky_Note の削除を要求した場合 THEN THE Postodo_System SHALL 削除前に確認ダイアログを表示する

### 要件 6: 付箋の外観カスタマイズ

**ユーザーストーリー:** ユーザーとして、付箋の外観をカスタマイズしたい。これにより、Todoを視覚的に分類できる。

#### 受け入れ条件

1. THE Postodo_System SHALL 3つの Sticky_Note サイズをサポートする: 小 (150x150px)、中 (200x180px)、大 (250x220px)
2. THE Postodo_System SHALL 6つの Sticky_Note カラーをサポートする: 黄色、ピンク、青、緑、オレンジ、紫
3. WHEN ユーザーがパレットアイコンから色を選択した場合 THEN THE Postodo_System SHALL Sticky_Note の色を更新し Note_File に永続化する
4. WHEN ユーザーがサイズピッカーからサイズを選択した場合 THEN THE Postodo_System SHALL Sticky_Note の寸法を更新し Note_File に永続化する

### 要件 7: ファイル同期

**ユーザーストーリー:** ユーザーとして、付箋が Obsidian ファイルと同期してほしい。これにより、両方のインターフェースからデータにアクセスできる。

#### 受け入れ条件

1. WHEN UI で Sticky_Note が変更された場合 THEN THE Sync_Manager SHALL デバウンス保存を使用して 500ms 以内に Note_File を更新する
2. WHEN Note_File が外部で変更された場合 THEN THE Sync_Manager SHALL UI 内の対応する Sticky_Note を更新する
3. WHEN UI とファイルが同時に変更された場合 THEN THE Conflict_Resolver SHALL 競合を検出し解決戦略を適用する
4. IF 同期操作が失敗した場合 THEN THE Postodo_System SHALL 指数バックオフで最大3回まで再試行する
5. WHEN 同期ステータスが変更された場合 THEN THE Postodo_System SHALL 視覚的インジケーター（保存済み、同期中、エラー）を表示する

### 要件 8: 競合解決

**ユーザーストーリー:** ユーザーとして、ファイルとUIの変更間の競合が自動的に解決されてほしい。これにより、データを失わない。

#### 受け入れ条件

1. WHEN 位置の競合が検出された場合 THEN THE Conflict_Resolver SHALL UI の変更を優先する（ユーザーがドラッグ中の可能性があるため）
2. WHEN コンテンツの競合が検出された場合 THEN THE Conflict_Resolver SHALL より新しい変更を優先する
3. WHEN メタデータの競合が検出された場合 THEN THE Conflict_Resolver SHALL 競合しないフィールドをマージする
4. IF 自動解決の信頼度が低い場合 THEN THE Conflict_Resolver SHALL ユーザーに解決方法の選択を促す

### 要件 9: FAB メニュー操作

**ユーザーストーリー:** ユーザーとして、フローティングメニューから一般的な操作に素早くアクセスしたい。これにより、効率的に操作を実行できる。

#### 受け入れ条件

1. WHEN ユーザーが FAB ボタンをクリックした場合 THEN THE FAB_Menu SHALL 時間差アニメーションでサブボタンを展開する
2. THE FAB_Menu SHALL 以下のオプションを提供する: 空の付箋追加、全付箋削除、位置ランダム化、ヘルプ表示
3. WHEN FAB_Menu が開いている状態でユーザーが外側をクリックした場合 THEN THE FAB_Menu SHALL 自動的に閉じる
4. WHEN 位置ランダム化が選択された場合 THEN THE Postodo_System SHALL スムーズなアニメーションで全ての Sticky_Note を再配置する

### 要件 10: レスポンシブ対応

**ユーザーストーリー:** ユーザーとして、異なる画面サイズでアプリを使用したい。これにより、どのデバイスでもTodoを管理できる。

#### 受け入れ条件

1. WHEN 画面幅が 768px 未満の場合 THEN THE Postodo_System SHALL コントロールを縦並びレイアウトに切り替える
2. WHEN 画面の向きが変更された場合 THEN THE Postodo_System SHALL レイアウトを調整し必要に応じて付箋を再配置する
3. THE Postodo_System SHALL モバイルでの全てのインタラクティブ要素に最小タッチターゲットサイズ 44px を確保する

### 要件 11: データ永続化

**ユーザーストーリー:** ユーザーとして、付箋がセッション間で永続化されてほしい。これにより、後で作業を続けられる。

#### 受け入れ条件

1. WHEN Postodo プラグインがロードされた場合 THEN THE Postodo_System SHALL Postodo_Folder 内の Note_File から全ての Sticky_Note を復元する
2. WHEN 付箋を復元する際 THE Postodo_System SHALL データの整合性を検証し無効な位置を修正する
3. IF Note_File に無効なデータが含まれている場合 THEN THE Postodo_System SHALL デフォルト値を適用し警告をログに記録する

### 要件 12: 依存性注入とモジュラー設計

**ユーザーストーリー:** 開発者として、依存性注入を備えたモジュラーアーキテクチャが欲しい。これにより、コンポーネントを簡単にテストおよび置換できる。

#### 受け入れ条件

1. THE DI_Container SHALL シングルトンとトランジェントのライフタイムでサービス登録をサポートする
2. THE DI_Container SHALL 登録されたトークンに基づいて依存関係を再帰的に解決する
3. WHEN サービスが要求された場合 THEN THE DI_Container SHALL 登録された実装を返すか、説明的なエラーをスローする
4. THE Event_Bus SHALL イベントの購読、購読解除、ワイルドカードパターンマッチングをサポートする

### 要件 13: プラグイン設定

**ユーザーストーリー:** ユーザーとして、プラグインの動作をカスタマイズしたい。これにより、自分のワークフローに合わせた設定ができる。

#### 受け入れ条件

1. THE Postodo_System SHALL Obsidian の設定タブでプラグイン設定画面を提供する
2. THE Postodo_System SHALL Naming_Strategy の設定オプションを提供する
3. WHERE ユーザーが Naming_Strategy を変更した場合 THE Postodo_System SHALL 新規作成される Note_File に新しい命名規則を適用する
4. THE Postodo_System SHALL 以下の Naming_Strategy オプションをサポートする: タイムスタンプ形式 (`Sticky-yyyyMMddHHmmss`)、連番形式 (`Sticky-{seqNo}`)、カスタム形式
5. WHEN 連番形式が選択された場合 THEN THE Postodo_System SHALL 既存の Note_File を走査して次の連番を自動決定する

