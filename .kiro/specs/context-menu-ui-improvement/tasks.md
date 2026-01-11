# 実装タスク

## タスク 1: 翻訳キーの追加

**Status: done**

### 詳細
- `src/i18n/translations.ts` にコンテキストメニュー用の翻訳キーを追加
- 日本語と英語の両方を定義

### 追加する翻訳キー
```typescript
contextMenu: {
    openNote: string;      // "ノートを開く" / "Open note"
    edit: string;          // "編集" / "Edit"
    changeColor: string;   // "色を変更" / "Change color"
    changeSize: string;    // "サイズ変更" / "Change size"
    markComplete: string;  // "完了にする" / "Mark complete"
    markIncomplete: string; // "未完了に戻す" / "Mark incomplete"
    delete: string;        // "削除" / "Delete"
    copyFilename: string;  // "ファイル名をコピー" / "Copy filename"
    colors: {
        yellow: string;
        pink: string;
        blue: string;
        green: string;
        orange: string;
        purple: string;
    };
    sizes: {
        small: string;
        medium: string;
        large: string;
    };
};
tooltip: {
    filename: string;      // "ファイル: {filename}" / "File: {filename}"
};
actionBar: {
    complete: string;      // "完了済み" / "Completed"
    incomplete: string;    // "未完了" / "Incomplete"
};
```

**Validates: Requirements 4.1, 4.2**

---

## タスク 2: タイトル欄の削除

**Status: done**

### 詳細
- `src/ui/postodo-view.ts` の `renderNote` メソッドからタイトル要素を削除
- タイトル編集関連のコードを削除
- `.note-content` の高さを調整（タイトル分のスペースを削除）

### 変更ファイル
- `src/ui/postodo-view.ts`
- `styles.css`

**Validates: Requirements 1.1, 1.2**

---

## タスク 3: アクションバーの簡素化

**Status: done**

### 詳細
- アクションバーから削除ボタンを削除（右クリックメニューに移動）
- チェックボックスのみを残す
- アクションバーのスタイルを調整

### 変更ファイル
- `src/ui/postodo-view.ts`
- `styles.css`

**Validates: Requirements 2.1, 2.2, 2.3**

---

## タスク 4: ツールチップの追加

**Status: done**

### 詳細
- 付箋要素にファイル名をツールチップとして設定
- `noteEl.title` にファイルパスまたはファイル名を設定

### 変更ファイル
- `src/ui/postodo-view.ts`

**Validates: Requirements 1.3**

---

## タスク 5: コンテキストメニューの実装

**Status: done**

### 詳細
- Obsidian の `Menu` クラスを使用してコンテキストメニューを実装
- 右クリックイベントハンドラーを追加
- メニュー項目を追加:
  - ノートを開く
  - 編集
  - 色を変更（サブメニュー）
  - サイズ変更（サブメニュー）
  - 完了にする / 未完了に戻す
  - ファイル名をコピー
  - 削除

### 変更ファイル
- `src/ui/postodo-view.ts`

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9**

---

## タスク 6: モバイル長押し対応

**Status: done**

### 詳細
- タッチデバイスでの長押し（500ms）でコンテキストメニューを表示
- `touchstart`, `touchend`, `touchmove` イベントを処理

### 変更ファイル
- `src/ui/postodo-view.ts`

**Validates: Requirements 5.1, 5.2**

---

## タスク 7: 多言語対応の統合

**Status: done**

### 詳細
- Obsidian の言語設定を取得する仕組みを実装
- コンテキストメニューとアクションバーで翻訳を使用
- 言語切り替え時の動的更新

### 変更ファイル
- `src/ui/postodo-view.ts`
- `src/i18n/translations.ts`

**Validates: Requirements 4.1, 4.2, 4.3, 4.4**

---

## タスク 8: テストの作成

**Status: not started**

### 詳細
- 翻訳キーの存在確認テスト
- コンテキストメニュー項目の生成テスト
- 完了状態に応じたメニューテキスト切り替えテスト

### 変更ファイル
- `src/i18n/translations.test.ts`（新規）

**Validates: Design Properties 1-6**

---

## 備考

- 各タスクは要件定義書の Requirements を参照
- Obsidian の `Menu` クラスを使用することで、ネイティブな見た目と操作感を実現
- 既存の `translations.ts` を拡張して多言語対応
- モバイル対応は長押しイベントで判定
