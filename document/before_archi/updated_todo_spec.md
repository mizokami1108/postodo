# 付箋 Todo アプリ 仕様書

## 📋 基本概要

白いホワイトボード風の背景に付箋を自由に配置できる Todo アプリ

## 🎨 デザイン・UI

- **背景**: 白いホワイトボード（微細なドット模様とグリッドライン）
- **フォント**: Google Fonts「Kalam」（手書き風フォント）
- **アイコン**: Material Design Icons (MDI) を使用
- **レスポンシブ対応**: デスクトップ・スマートフォン両対応

## 📌 付箋機能

### 基本仕様

- **サイズ**: 3 種類（小：150×150px、中：200×180px、大：250×220px）
- **カラー**: 6 色（黄色、ピンク、青、緑、オレンジ、紫）
- **回転**: 付箋らしい微細な傾き効果
- **影**: ドロップシャドウで立体感

### 操作機能

- **ドラッグ移動**: 付箋を自由にドラッグして配置
- **フォーカスハイライト**: テキスト入力時に青ボーダーで強調表示
- **個別色変更**: パレットアイコンから 6 色選択
- **削除**: ゴミ箱アイコンで削除（回転縮小アニメーション）
- **作成日時表示**: 付箋右下に作成日時

## ➕ Todo 作成方法

### 1. 下部入力フォーム

- **位置**: 画面下部中央
- **機能**: テキスト入力 → Enter or +ボタンで作成
- **事前設定**: サイズピッカー・カラーピッカーで属性選択

### 2. ヘッダーメニュー

- **配置**: ヘッダー右側のメニューボタン
- **展開**: ドロップダウン形式でメニュー表示
- **アクセシビリティ**: 直感的でアクセスしやすい配置

## 🔘 ヘッダーメニュー機能

1. **📝 空の付箋追加** (`mdi-note-plus`) - 空白付箋を作成
2. **🗑️ 全付箋削除** (`mdi-delete-sweep`) - 確認ダイアログ付き全削除 
3. **🎲 付箋ランダム配置** (`mdi-shuffle-variant`) - ランダム配置アニメーション
4. **💾 手動保存** (`mdi-content-save`) - localStorage への手動保存
5. **📤 エクスポート** (`mdi-export`) - JSON ファイルダウンロード
6. **📥 インポート** (`mdi-import`) - JSON ファイル読み込み
7. **⚙️ 設定** (`mdi-cog`) - アプリケーション設定
8. **❓ ヘルプ** (`mdi-help-circle`) - 使い方ガイド

## 🎛️ 下部コントロール

### ドロップダウンピッカー

- **サイズピッカー**: 小・中・大から選択
- **カラーピッカー**: 6 色から選択（色ドット付き表示）
- **ドロップダウン方向**: 上に展開（入力フォームと重ならない）

### Todo 入力フォーム

- **スタイル**: 角丸・半透明背景・ぼかし効果
- **入力方法**: テキスト入力 + Enter キー or +ボタン
- **リセット**: 作成後に入力フィールドクリア

## 📱 レスポンシブ仕様

- **デスクトップ**: 横並びレイアウト
- **スマートフォン**: 縦並びレイアウト・幅調整
- **メニュー**: 画面サイズに応じてボタンサイズ調整

## ⚡ アニメーション・エフェクト（Anime.js実装）

### 📚 使用ライブラリ
- **Anime.js**: 軽量で高性能なアニメーションライブラリ
- **CDN**: `https://cdnjs.cloudflare.com/ajax/libs/animejs/3.2.1/anime.min.js`

### 🎭 基本アニメーション

#### 付箋操作アニメーション
- **ホバー**: 回転リセット・拡大・シャドウ強化
- **ドラッグ中**: 拡大・シャドウ強化・最前面表示
- **作成時**: フェードイン + 軽い バウンス効果
- **個別削除**: 回転縮小・フェードアウト

#### 基本アニメーション実装例
```javascript
// 付箋作成時
anime({
  targets: '.new-note',
  scale: [0, 1],
  opacity: [0, 1],
  rotate: [180, 0],
  duration: 600,
  easing: 'easeOutElastic(1, .5)'
});

// ドラッグ開始時
anime({
  targets: '.dragging',
  scale: 1.1,
  boxShadow: '0 12px 24px rgba(0,0,0,0.3)',
  duration: 200,
  easing: 'easeOutQuad'
});
```

### 🎪 全削除時のランダムアニメーション

全付箋削除時に以下5つのアニメーションからランダム選択：

#### 1. 🌪️ スピン落下アニメーション
```javascript
anime({
  targets: '.sticky-note',
  translateY: 1000,
  rotate: 720,
  opacity: [1, 0],
  scale: [1, 0],
  duration: 2000,
  delay: anime.stagger(100),
  easing: 'easeInQuad'
});
```

#### 2. 🍂 自然落下アニメーション  
```javascript
anime({
  targets: '.sticky-note',
  translateY: 1000,
  translateX: anime.random(-50, 50),
  rotate: anime.random(-30, 30),
  opacity: [1, 0],
  duration: 1500,
  delay: anime.stagger(100),
  easing: 'easeInCubic'
});
```

#### 3. 👻 フェードアウトアニメーション
```javascript
anime({
  targets: '.sticky-note',
  opacity: [1, 0],
  scale: [1, 0.6],
  duration: 1000,
  delay: anime.stagger(100),
  easing: 'easeOutQuart'
});
```

#### 4. 🗑️ ゴミ箱吸い込みアニメーション
```javascript
// ゴミ箱出現
anime({
  targets: '.trash-can',
  opacity: [0, 1],
  scale: [0, 1],
  duration: 300
});

// 付箋をゴミ箱に吸い込み
anime({
  targets: '.sticky-note',
  translateX: function(el) {
    return calculateTrashPosition(el).x;
  },
  translateY: function(el) {
    return calculateTrashPosition(el).y;
  },
  scale: [1, 0],
  rotate: 360,
  duration: 1500,
  delay: anime.stagger(100),
  easing: 'easeInOutQuad'
});
```

#### 5. 🦵 歩行脱出アニメーション
```javascript
// 足アイコン表示
anime({
  targets: '.sticky-note::after',
  opacity: [0, 1],
  duration: 200
});

// 左右ランダムに歩いて退場
anime({
  targets: '.sticky-note',
  translateX: function() {
    return anime.random(-1, 1) > 0 ? 800 : -800;
  },
  rotate: anime.random(-20, 20),
  opacity: [1, 0],
  duration: 2000,
  delay: anime.stagger(100),
  easing: 'easeOutQuad'
});
```

### 🎲 ランダム配置アニメーション
```javascript
anime({
  targets: '.sticky-note',
  translateX: function() {
    return anime.random(0, workspace.width - 250);
  },
  translateY: function() {
    return anime.random(0, workspace.height - 220);
  },
  rotate: function() {
    return anime.random(-6, 6);
  },
  duration: 800,
  delay: anime.stagger(50),
  easing: 'easeOutElastic(1, .6)'
});
```

### ⚙️ アニメーション設定

#### パフォーマンス最適化
- **ハードウェアアクセラレーション**: transform3d使用
- **バッチ処理**: 複数要素の同時アニメーション
- **メモリ管理**: アニメーション完了後のクリーンアップ

#### カスタマイズ可能な設定
- **アニメーション速度**: 設定で調整可能
- **有効/無効**: 設定でアニメーション ON/OFF
- **遅延時間**: stagger間隔の調整

## 🛡️ UX 配慮

- **画面外制限**: ドラッグ時に付箋が画面外に出ないよう制限
- **クリック領域分離**: テキスト・ボタン部分はドラッグ無効
- **自動フォーカス**: 新規作成時にテキストエリアにフォーカス
- **外部クリック閉じ**: ドロップダウン・メニューの自動閉じ
- **アニメーション配慮**: モーション感受性への配慮

## 💾 データ永続化

### localStorage 活用
- **自動保存**: 付箋操作時の自動保存
- **設定保存**: アニメーション設定も含めて保存
- **復元機能**: ページ再読み込み時の状態復元

### エクスポート/インポート
- **JSON 形式**: 人間が読める形式での保存
- **互換性**: 異なるブラウザ・デバイス間での移行対応

この仕様により、Anime.js を活用した滑らかで楽しいアニメーションを持つ、実用的な付箋 Todo アプリが実現されます！