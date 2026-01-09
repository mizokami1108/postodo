# 実装計画: Postodo 付箋 Todo アプリ

## 概要

既存の実装を基に、要件定義書で定義された機能を完成させます。主な追加・改善項目は以下の通りです：
- タイトルと本文の分離
- ファイル命名戦略（NamingStrategy）
- 表示フィルター（DisplayFilter）
- 競合解決システムの強化
- プラグイン設定画面の拡充

## タスク

- [x] 1. データモデルの拡張
  - [x] 1.1 StickyNote エンティティにタイトルフィールドを追加
    - `src/types/core-types.ts` の StickyNote インターフェースに `title: string` を追加
    - _Requirements: 2.5, 2.6_
  - [x] 1.2 PostodoNoteDetector のタイトル対応
    - `src/utils/postodo-note-detector.ts` でタイトルの抽出・更新ロジックを追加
    - Markdown の H1 見出しをタイトルとして扱う
    - _Requirements: 2.5, 2.6_
  - [x] 1.3 プロパティテスト: タイトルと本文の独立編集
    - **Property 4: タイトル変更時のファイル名同期**
    - **Validates: Requirements 2.5**

- [x] 2. ファイル命名戦略の実装
  - [x] 2.1 NamingStrategy インターフェースの作成
    - `src/interfaces/naming/i-naming-strategy.ts` を作成
    - _Requirements: 1.6, 13.4_
  - [x] 2.2 TimestampNamingStrategy の実装
    - `src/implementations/naming/timestamp-naming-strategy.ts` を作成
    - `Sticky-yyyyMMddHHmmss` 形式でファイル名を生成
    - _Requirements: 1.7_
  - [x] 2.3 SequentialNamingStrategy の実装
    - `src/implementations/naming/sequential-naming-strategy.ts` を作成
    - 既存ファイルを走査して次の連番を決定
    - _Requirements: 13.5_
  - [x] 2.4 NamingStrategy の DI 登録と DataManager への統合
    - ConfigProvider から命名戦略を取得
    - DataManager.buildNote で NamingStrategy を使用
    - _Requirements: 1.6, 13.3_
  - [x] 2.5 プロパティテスト: ファイル命名規則
    - **Property 3: ファイル命名規則の適用**
    - **Validates: Requirements 1.6, 1.7, 13.3**
  - [x] 2.6 プロパティテスト: 連番の一意性
    - **Property 19: 連番の一意性保証**
    - **Validates: Requirements 13.5**

- [x] 3. 表示フィルターの実装
  - [x] 3.1 DisplayFilter インターフェースと実装の作成
    - `src/interfaces/ui/i-display-filter.ts` を作成
    - `src/implementations/ui/display-filter.ts` を作成
    - 3つのフィルターオプション: incomplete, complete, all
    - _Requirements: 4.5, 4.7_
  - [x] 3.2 PostodoView へのフィルター UI 追加
    - フィルター選択ドロップダウンを追加
    - フィルター変更時の即座更新
    - _Requirements: 4.6_
  - [x] 3.3 DataManager のフィルター対応
    - フィルター条件に基づく付箋の表示/非表示ロジック
    - _Requirements: 4.2, 4.3_
  - [x] 3.4 プロパティテスト: フィルターと完了ステータスの連動
    - **Property 8: 完了ステータスとフィルターの連動**
    - **Validates: Requirements 4.2, 4.3, 4.6**

- [ ] 4. チェックポイント - 基本機能の確認
  - 全てのテストが通ることを確認
  - 質問があればユーザーに確認

- [ ] 5. タイトル変更時のファイル名変更
  - [ ] 5.1 NoteRepository.rename メソッドの実装
    - タイトル変更時にファイル名を変更
    - ファイルパスの更新とキャッシュの更新
    - _Requirements: 2.5_
  - [ ] 5.2 DataManager.renameNote メソッドの追加
    - バリデーションとイベント発火
    - _Requirements: 2.5_
  - [ ] 5.3 PostodoView でのタイトル編集 UI
    - タイトル編集フィールドの追加
    - 編集完了時のファイル名変更トリガー
    - _Requirements: 2.5, 2.6_

- [ ] 6. 競合解決システムの強化
  - [ ] 6.1 ConflictResolver インターフェースの作成
    - `src/interfaces/sync/i-conflict-resolver.ts` を作成
    - _Requirements: 8.1, 8.2, 8.3_
  - [ ] 6.2 ConflictResolver 実装の作成
    - `src/implementations/sync/conflict-resolver.ts` を作成
    - 位置競合: UI 優先
    - コンテンツ競合: 新しい方優先
    - メタデータ競合: マージ
    - _Requirements: 8.1, 8.2, 8.3_
  - [ ] 6.3 SyncManager への ConflictResolver 統合
    - 競合検出と解決フローの実装
    - _Requirements: 7.3_
  - [ ] 6.4 プロパティテスト: 位置競合解決
    - **Property 11: 位置競合時のUI優先**
    - **Validates: Requirements 8.1**
  - [ ] 6.5 プロパティテスト: コンテンツ競合解決
    - **Property 12: コンテンツ競合時の新しい方優先**
    - **Validates: Requirements 8.2**
  - [ ] 6.6 プロパティテスト: メタデータマージ
    - **Property 13: メタデータ競合時のマージ**
    - **Validates: Requirements 8.3**

- [ ] 7. チェックポイント - 同期機能の確認
  - 全てのテストが通ることを確認
  - 質問があればユーザーに確認

- [ ] 8. プラグイン設定画面の拡充
  - [ ] 8.1 PostodoSettingsTab の拡張
    - Naming_Strategy 選択オプションの追加
    - デフォルト Display_Filter 設定の追加
    - _Requirements: 13.1, 13.2, 13.4_
  - [ ] 8.2 設定変更の即座反映
    - ConfigProvider の設定変更通知
    - UI への即座反映
    - _Requirements: 13.3_

- [ ] 9. 同期リトライ機能の強化
  - [ ] 9.1 指数バックオフリトライの実装
    - 失敗時に 1秒、2秒、4秒 の間隔でリトライ
    - 最大3回まで
    - _Requirements: 7.4_
  - [ ] 9.2 プロパティテスト: リトライ動作
    - **Property 14: 同期失敗時のリトライ**
    - **Validates: Requirements 7.4**

- [ ] 10. データ復元時の整合性検証
  - [ ] 10.1 位置データの検証と修正
    - Canvas 境界外の位置を修正
    - 無効なデータにデフォルト値を適用
    - _Requirements: 11.2, 11.3_
  - [ ] 10.2 プロパティテスト: データ復元の整合性
    - **Property 15: データ復元時の整合性検証**
    - **Validates: Requirements 11.2, 11.3**

- [ ] 11. 既存機能のプロパティテスト追加
  - [ ] 11.1 プロパティテスト: 付箋作成時のファイル生成
    - **Property 1: 付箋作成時のファイル生成**
    - **Validates: Requirements 1.3, 1.4**
  - [ ] 11.2 プロパティテスト: 空コンテンツの作成拒否
    - **Property 2: 空コンテンツの作成拒否**
    - **Validates: Requirements 1.5**
  - [ ] 11.3 プロパティテスト: UI変更のファイル同期
    - **Property 5: UI変更のファイル同期（ラウンドトリップ）**
    - **Validates: Requirements 2.2, 7.1**
  - [ ] 11.4 プロパティテスト: ファイル変更のUI同期
    - **Property 6: ファイル変更のUI同期**
    - **Validates: Requirements 2.3, 7.2**
  - [ ] 11.5 プロパティテスト: ドラッグ位置の境界制限
    - **Property 7: ドラッグ位置の境界制限**
    - **Validates: Requirements 3.4**
  - [ ] 11.6 プロパティテスト: 削除時のファイル削除
    - **Property 9: 削除時のファイル削除**
    - **Validates: Requirements 5.2**
  - [ ] 11.7 プロパティテスト: 外観変更の永続化
    - **Property 10: 外観変更の永続化**
    - **Validates: Requirements 6.3, 6.4**

- [ ] 12. DIコンテナとイベントバスのプロパティテスト
  - [ ] 12.1 プロパティテスト: シングルトン保証
    - **Property 16: DIコンテナのシングルトン保証**
    - **Validates: Requirements 12.1, 12.3**
  - [ ] 12.2 プロパティテスト: 依存関係解決
    - **Property 17: DIコンテナの依存関係解決**
    - **Validates: Requirements 12.2**
  - [ ] 12.3 プロパティテスト: イベントパターンマッチング
    - **Property 18: イベントバスのパターンマッチング**
    - **Validates: Requirements 12.4**

- [ ] 13. 最終チェックポイント
  - 全てのテストが通ることを確認
  - 質問があればユーザーに確認

## 備考

- 各タスクは要件定義書の Requirements を参照
- プロパティテストは fast-check を使用
- 既存の実装（DIContainer, EventBus, NoteRepository, DataManager）は活用

