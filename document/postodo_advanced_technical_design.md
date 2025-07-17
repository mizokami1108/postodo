# Postodo高度技術設計 - 同期・性能・モバイル対応

## 🔄 1. リアルタイム同期の詳細設計

### 1.1 同期アーキテクチャ概要

```typescript
interface SyncState {
    lastSync: number;
    pendingChanges: Map<string, PendingChange>;
    conflictResolver: ConflictResolver;
    syncQueue: SyncQueue;
}

interface PendingChange {
    id: string;
    type: 'create' | 'update' | 'delete' | 'move';
    timestamp: number;
    data: any;
    retryCount: number;
}
```

### 1.2 ファイル監視システム

#### コアファイルウォッチャー
```typescript
export class PostodoSyncManager extends Events {
    private fileWatchers = new Map<string, TFile>();
    private syncState: SyncState;
    private debounceTimers = new Map<string, NodeJS.Timeout>();
    
    constructor(private vault: Vault, private dataManager: PostodoDataManager) {
        super();
        this.initializeFileWatching();
    }

    private initializeFileWatching(): void {
        // 1. ファイル作成の監視
        this.vault.on('create', (file) => {
            if (this.isPostodoFile(file)) {
                this.handleFileCreated(file);
            }
        });

        // 2. ファイル変更の監視（デバウンス付き）
        this.vault.on('modify', (file) => {
            if (this.isPostodoFile(file)) {
                this.debounceFileChange(file);
            }
        });

        // 3. ファイル削除の監視
        this.vault.on('delete', (file) => {
            if (this.isPostodoFile(file)) {
                this.handleFileDeleted(file);
            }
        });

        // 4. ファイル名変更の監視
        this.vault.on('rename', (file, oldPath) => {
            if (this.isPostodoFile(file) || oldPath.startsWith('Postodo/')) {
                this.handleFileRenamed(file, oldPath);
            }
        });
    }

    private debounceFileChange(file: TFile): void {
        const key = file.path;
        
        // 既存のタイマーをクリア
        if (this.debounceTimers.has(key)) {
            clearTimeout(this.debounceTimers.get(key)!);
        }

        // 新しいタイマーを設定（500ms遅延）
        const timer = setTimeout(() => {
            this.handleFileModified(file);
            this.debounceTimers.delete(key);
        }, 500);

        this.debounceTimers.set(key, timer);
    }

    private async handleFileModified(file: TFile): Promise<void> {
        try {
            // 1. ファイルロック確認
            if (this.isFileLocked(file)) {
                this.scheduleRetry(file, 'modify');
                return;
            }

            // 2. 変更内容の解析
            const content = await this.vault.read(file);
            const note = await this.parseFileContent(file, content);
            
            if (!note) return;

            // 3. UI側で同じノートが編集中かチェック
            if (this.dataManager.isNoteBeingEdited(note.id)) {
                // 競合を検出 - 競合解決フローを開始
                await this.handleConflict(note, 'file-modified');
                return;
            }

            // 4. 正常な同期処理
            await this.dataManager.updateNoteFromFile(note);
            this.trigger('note-synced', { id: note.id, source: 'file' });

        } catch (error) {
            console.error('File modification sync error:', error);
            this.handleSyncError(file, 'modify', error);
        }
    }
}
```

### 1.3 競合解決システム

#### 競合検出・解決戦略
```typescript
export class ConflictResolver {
    async handleConflict(
        fileNote: StickyNote, 
        uiNote: StickyNote, 
        conflictType: 'content' | 'metadata' | 'position'
    ): Promise<ResolveResult> {
        
        const resolution = await this.determineResolutionStrategy(fileNote, uiNote, conflictType);
        
        switch (resolution.strategy) {
            case 'file-wins':
                return this.applyFileChanges(fileNote, uiNote);
                
            case 'ui-wins':
                return this.applyUIChanges(fileNote, uiNote);
                
            case 'merge':
                return this.mergeChanges(fileNote, uiNote);
                
            case 'user-choice':
                return this.promptUserResolution(fileNote, uiNote);
                
            default:
                throw new Error(`Unknown resolution strategy: ${resolution.strategy}`);
        }
    }

    private async determineResolutionStrategy(
        fileNote: StickyNote, 
        uiNote: StickyNote, 
        conflictType: string
    ): Promise<ResolutionStrategy> {
        
        // 1. 変更時刻による自動解決
        const fileTime = new Date(fileNote.metadata.modified).getTime();
        const uiTime = new Date(uiNote.metadata.modified).getTime();
        const timeDiff = Math.abs(fileTime - uiTime);

        // 5秒以内の変更は同時編集とみなす
        if (timeDiff < 5000) {
            return { strategy: 'merge', confidence: 0.8 };
        }

        // 2. 変更タイプ別の解決戦略
        switch (conflictType) {
            case 'position':
                // 位置変更はUI側を優先（ユーザーがドラッグ中の可能性）
                return { strategy: 'ui-wins', confidence: 0.9 };
                
            case 'content':
                // コンテンツ変更は新しい方を優先
                return { 
                    strategy: fileTime > uiTime ? 'file-wins' : 'ui-wins', 
                    confidence: 0.7 
                };
                
            case 'metadata':
                // メタデータはマージ可能
                return { strategy: 'merge', confidence: 0.8 };
                
            default:
                return { strategy: 'user-choice', confidence: 0.5 };
        }
    }

    private async mergeChanges(fileNote: StickyNote, uiNote: StickyNote): Promise<ResolveResult> {
        const merged: StickyNote = {
            ...uiNote,
            // コンテンツは最新のものを使用
            content: new Date(fileNote.metadata.modified) > new Date(uiNote.metadata.modified) 
                ? fileNote.content 
                : uiNote.content,
            
            // 位置はUI側を優先（ユーザーが移動中の可能性）
            position: uiNote.position,
            
            // メタデータをマージ
            metadata: {
                ...uiNote.metadata,
                tags: [...new Set([...fileNote.metadata.tags, ...uiNote.metadata.tags])],
                links: [...new Set([...fileNote.metadata.links, ...uiNote.metadata.links])],
                modified: new Date().toISOString()
            }
        };

        return {
            success: true,
            result: merged,
            strategy: 'merge'
        };
    }

    private async promptUserResolution(
        fileNote: StickyNote, 
        uiNote: StickyNote
    ): Promise<ResolveResult> {
        return new Promise((resolve) => {
            // モーダルダイアログで解決方法をユーザーに選択させる
            const modal = new ConflictResolutionModal(
                this.app,
                fileNote,
                uiNote,
                (choice: 'file' | 'ui' | 'merge') => {
                    switch (choice) {
                        case 'file':
                            resolve(this.applyFileChanges(fileNote, uiNote));
                            break;
                        case 'ui':
                            resolve(this.applyUIChanges(fileNote, uiNote));
                            break;
                        case 'merge':
                            resolve(this.mergeChanges(fileNote, uiNote));
                            break;
                    }
                }
            );
            modal.open();
        });
    }
}

interface ResolutionStrategy {
    strategy: 'file-wins' | 'ui-wins' | 'merge' | 'user-choice';
    confidence: number;
}

interface ResolveResult {
    success: boolean;
    result: StickyNote;
    strategy: string;
    error?: Error;
}
```

### 1.4 同期キューシステム

#### 順序保証つき同期処理
```typescript
export class SyncQueue {
    private queue: SyncOperation[] = [];
    private processing = false;
    private maxRetries = 3;

    async enqueue(operation: SyncOperation): Promise<void> {
        this.queue.push(operation);
        
        if (!this.processing) {
            await this.processQueue();
        }
    }

    private async processQueue(): Promise<void> {
        this.processing = true;

        while (this.queue.length > 0) {
            const operation = this.queue.shift()!;
            
            try {
                await this.executeOperation(operation);
                this.onOperationSuccess(operation);
                
            } catch (error) {
                if (operation.retryCount < this.maxRetries) {
                    operation.retryCount++;
                    // 指数バックオフで再試行
                    const delay = Math.pow(2, operation.retryCount) * 1000;
                    setTimeout(() => this.queue.unshift(operation), delay);
                } else {
                    this.onOperationFailed(operation, error);
                }
            }
        }

        this.processing = false;
    }

    private async executeOperation(operation: SyncOperation): Promise<void> {
        switch (operation.type) {
            case 'file-to-ui':
                await this.syncFileToUI(operation);
                break;
            case 'ui-to-file':
                await this.syncUIToFile(operation);
                break;
            case 'resolve-conflict':
                await this.resolveConflict(operation);
                break;
        }
    }
}
```

---

## ⚡ 2. 大量データ処理の最適化戦略

### 2.1 仮想化システム

#### Canvas仮想化
```typescript
export class VirtualizedCanvas {
    private viewport: Viewport;
    private virtualNodes = new Map<string, VirtualNode>();
    private renderedNodes = new Map<string, HTMLElement>();
    private intersectionObserver: IntersectionObserver;
    
    constructor(private container: HTMLElement) {
        this.setupViewport();
        this.setupIntersectionObserver();
    }

    private setupIntersectionObserver(): void {
        // 表示領域に入った/出た要素を検出
        this.intersectionObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    const noteId = entry.target.getAttribute('data-note-id')!;
                    
                    if (entry.isIntersecting) {
                        this.renderNote(noteId);
                    } else {
                        this.unrenderNote(noteId);
                    }
                });
            },
            {
                // ビューポートより少し大きい範囲で監視
                rootMargin: '50px',
                threshold: 0
            }
        );
    }

    updateNotes(notes: StickyNote[]): void {
        // 1. 仮想ノードマップの更新
        this.virtualNodes.clear();
        notes.forEach(note => {
            this.virtualNodes.set(note.id, {
                id: note.id,
                bounds: this.calculateNoteBounds(note),
                data: note,
                isVisible: false
            });
        });

        // 2. 表示領域内のノードを特定
        const visibleIds = this.getVisibleNodeIds();
        
        // 3. 不要なノードを削除
        for (const [id, element] of this.renderedNodes) {
            if (!visibleIds.has(id)) {
                this.unrenderNote(id);
            }
        }

        // 4. 新しく必要なノードをレンダリング
        visibleIds.forEach(id => {
            if (!this.renderedNodes.has(id)) {
                this.renderNote(id);
            }
        });
    }

    private getVisibleNodeIds(): Set<string> {
        const visible = new Set<string>();
        const viewBounds = this.getViewportBounds();

        for (const [id, vNode] of this.virtualNodes) {
            if (this.boundsIntersect(viewBounds, vNode.bounds)) {
                visible.add(id);
            }
        }

        return visible;
    }

    private renderNote(noteId: string): void {
        const vNode = this.virtualNodes.get(noteId);
        if (!vNode || this.renderedNodes.has(noteId)) return;

        // DOM要素を作成してレンダリング
        const element = this.createNoteElement(vNode.data);
        this.container.appendChild(element);
        this.renderedNodes.set(noteId, element);
        
        // Intersection Observerに登録
        this.intersectionObserver.observe(element);

        vNode.isVisible = true;
    }

    private unrenderNote(noteId: string): void {
        const element = this.renderedNodes.get(noteId);
        const vNode = this.virtualNodes.get(noteId);
        
        if (element) {
            this.intersectionObserver.unobserve(element);
            element.remove();
            this.renderedNodes.delete(noteId);
        }

        if (vNode) {
            vNode.isVisible = false;
        }
    }

    // パフォーマンス最適化: 境界矩形の効率的計算
    private boundsIntersect(a: Bounds, b: Bounds): boolean {
        return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
    }
}

interface VirtualNode {
    id: string;
    bounds: Bounds;
    data: StickyNote;
    isVisible: boolean;
}

interface Bounds {
    left: number;
    top: number;
    right: number;
    bottom: number;
}
```

### 2.2 データインデックス化

#### 高速検索・フィルタリング
```typescript
export class PostodoIndex {
    private spatialIndex: SpatialIndex;
    private textIndex: TextIndex;
    private tagIndex: Map<string, Set<string>>;
    private dateIndex: Map<string, StickyNote[]>;

    constructor() {
        this.spatialIndex = new SpatialIndex();
        this.textIndex = new TextIndex();
        this.tagIndex = new Map();
        this.dateIndex = new Map();
    }

    rebuildIndex(notes: StickyNote[]): void {
        this.clear();

        notes.forEach(note => {
            // 1. 空間インデックス（位置ベース検索用）
            this.spatialIndex.insert(note.id, {
                x: note.position.x,
                y: note.position.y,
                width: note.dimensions.width,
                height: note.dimensions.height
            });

            // 2. テキストインデックス（全文検索用）
            this.textIndex.addDocument(note.id, note.content);

            // 3. タグインデックス
            note.metadata.tags.forEach(tag => {
                if (!this.tagIndex.has(tag)) {
                    this.tagIndex.set(tag, new Set());
                }
                this.tagIndex.get(tag)!.add(note.id);
            });

            // 4. 日付インデックス
            const dateKey = new Date(note.metadata.created).toDateString();
            if (!this.dateIndex.has(dateKey)) {
                this.dateIndex.set(dateKey, []);
            }
            this.dateIndex.get(dateKey)!.push(note);
        });
    }

    // 空間検索: 指定領域内の付箋を高速取得
    findNotesInRegion(x: number, y: number, width: number, height: number): string[] {
        return this.spatialIndex.query(x, y, width, height);
    }

    // テキスト検索: 高速全文検索
    searchNotes(query: string): string[] {
        return this.textIndex.search(query);
    }

    // タグ検索
    findNotesByTag(tag: string): string[] {
        return Array.from(this.tagIndex.get(tag) || []);
    }

    // 複合検索: 複数条件の組み合わせ
    findNotes(criteria: SearchCriteria): string[] {
        let results = new Set<string>();
        let isFirstCriteria = true;

        // テキスト条件
        if (criteria.text) {
            const textResults = new Set(this.searchNotes(criteria.text));
            results = isFirstCriteria ? textResults : this.intersection(results, textResults);
            isFirstCriteria = false;
        }

        // タグ条件
        if (criteria.tags?.length) {
            let tagResults = new Set<string>();
            criteria.tags.forEach(tag => {
                const tagNotes = new Set(this.findNotesByTag(tag));
                tagResults = tagResults.size === 0 ? tagNotes : this.intersection(tagResults, tagNotes);
            });
            results = isFirstCriteria ? tagResults : this.intersection(results, tagResults);
            isFirstCriteria = false;
        }

        // 空間条件
        if (criteria.region) {
            const spatialResults = new Set(this.findNotesInRegion(
                criteria.region.x, criteria.region.y,
                criteria.region.width, criteria.region.height
            ));
            results = isFirstCriteria ? spatialResults : this.intersection(results, spatialResults);
        }

        return Array.from(results);
    }

    private intersection<T>(setA: Set<T>, setB: Set<T>): Set<T> {
        return new Set([...setA].filter(x => setB.has(x)));
    }
}

// 空間インデックス（R-tree的な実装）
class SpatialIndex {
    private grid: Map<string, Set<string>> = new Map();
    private gridSize = 200; // 200px単位でグリッド分割

    insert(id: string, bounds: { x: number; y: number; width: number; height: number }): void {
        const gridCells = this.getBoundingGridCells(bounds);
        
        gridCells.forEach(cellKey => {
            if (!this.grid.has(cellKey)) {
                this.grid.set(cellKey, new Set());
            }
            this.grid.get(cellKey)!.add(id);
        });
    }

    query(x: number, y: number, width: number, height: number): string[] {
        const gridCells = this.getBoundingGridCells({ x, y, width, height });
        const candidates = new Set<string>();

        gridCells.forEach(cellKey => {
            const cellItems = this.grid.get(cellKey);
            if (cellItems) {
                cellItems.forEach(id => candidates.add(id));
            }
        });

        return Array.from(candidates);
    }

    private getBoundingGridCells(bounds: { x: number; y: number; width: number; height: number }): string[] {
        const cells: string[] = [];
        
        const startGridX = Math.floor(bounds.x / this.gridSize);
        const endGridX = Math.floor((bounds.x + bounds.width) / this.gridSize);
        const startGridY = Math.floor(bounds.y / this.gridSize);
        const endGridY = Math.floor((bounds.y + bounds.height) / this.gridSize);

        for (let gx = startGridX; gx <= endGridX; gx++) {
            for (let gy = startGridY; gy <= endGridY; gy++) {
                cells.push(`${gx},${gy}`);
            }
        }

        return cells;
    }
}
```

### 2.3 メモリ効率化

#### オブジェクトプール・WeakMapの活用
```typescript
export class MemoryOptimizer {
    // DOM要素のオブジェクトプール
    private elementPool: HTMLElement[] = [];
    private maxPoolSize = 100;

    // WeakMapによる効率的な関連付け
    private noteElementMap = new WeakMap<HTMLElement, string>();
    private elementEventHandlers = new WeakMap<HTMLElement, EventHandlers>();

    // DOM要素の再利用
    acquireElement(): HTMLElement {
        if (this.elementPool.length > 0) {
            return this.elementPool.pop()!;
        }
        return this.createElement();
    }

    releaseElement(element: HTMLElement): void {
        // イベントハンドラーのクリーンアップ
        this.cleanupElementEvents(element);
        
        // プールに戻す
        if (this.elementPool.length < this.maxPoolSize) {
            this.resetElement(element);
            this.elementPool.push(element);
        }
    }

    private cleanupElementEvents(element: HTMLElement): void {
        const handlers = this.elementEventHandlers.get(element);
        if (handlers) {
            Object.entries(handlers).forEach(([event, handler]) => {
                element.removeEventListener(event, handler);
            });
            this.elementEventHandlers.delete(element);
        }
    }

    // 段階的ガベージコレクション
    performIncrementalCleanup(): void {
        // フレーム単位での段階的クリーンアップ
        requestIdleCallback((deadline) => {
            while (deadline.timeRemaining() > 0 && this.hasCleanupWork()) {
                this.performCleanupChunk();
            }
        });
    }
}
```

---

## 📱 3. モバイルUXの具体的な実装方針

### 3.1 タッチイベント詳細実装

#### マルチタッチ対応のドラッグシステム
```typescript
export class MobileTouchHandler {
    private activeTouches = new Map<number, TouchInfo>();
    private dragState: DragState | null = null;
    private pinchState: PinchState | null = null;

    constructor(private canvas: HTMLElement) {
        this.setupTouchEvents();
    }

    private setupTouchEvents(): void {
        // Passive listenersでスクロール性能を向上
        this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: true });
        this.canvas.addEventListener('touchcancel', this.handleTouchCancel.bind(this), { passive: true });
    }

    private handleTouchStart(event: TouchEvent): void {
        // デフォルトのスクロール・ズーム動作を防止
        if (this.shouldPreventDefault(event)) {
            event.preventDefault();
        }

        Array.from(event.changedTouches).forEach(touch => {
            this.activeTouches.set(touch.identifier, {
                id: touch.identifier,
                startX: touch.clientX,
                startY: touch.clientY,
                currentX: touch.clientX,
                currentY: touch.clientY,
                startTime: Date.now(),
                target: event.target as HTMLElement
            });
        });

        // 操作の種類を判定
        if (this.activeTouches.size === 1) {
            this.initiateDragOperation(event);
        } else if (this.activeTouches.size === 2) {
            this.initiatePinchOperation(event);
        }
    }

    private handleTouchMove(event: TouchEvent): void {
        event.preventDefault(); // スクロールを確実に防止

        // アクティブなタッチの位置を更新
        Array.from(event.changedTouches).forEach(touch => {
            const touchInfo = this.activeTouches.get(touch.identifier);
            if (touchInfo) {
                touchInfo.currentX = touch.clientX;
                touchInfo.currentY = touch.clientY;
            }
        });

        // 操作の実行
        if (this.dragState && this.activeTouches.size === 1) {
            this.updateDragOperation();
        } else if (this.pinchState && this.activeTouches.size === 2) {
            this.updatePinchOperation();
        }
    }

    private initiateDragOperation(event: TouchEvent): void {
        const touch = Array.from(this.activeTouches.values())[0];
        const targetNote = this.findNoteElement(touch.target);

        if (targetNote) {
            // 付箋のドラッグ開始
            this.dragState = {
                noteId: targetNote.dataset.noteId!,
                element: targetNote,
                startOffset: this.calculateOffset(touch, targetNote),
                isDragging: false
            };

            // 視覚的フィードバック（少し遅延させて誤操作を防ぐ）
            setTimeout(() => {
                if (this.dragState && !this.dragState.isDragging) {
                    this.startVisualDrag();
                }
            }, 150);
        } else {
            // キャンバスのパン操作開始
            this.initiatePanOperation(touch);
        }
    }

    private updateDragOperation(): void {
        if (!this.dragState) return;

        const touch = Array.from(this.activeTouches.values())[0];
        const deltaX = touch.currentX - touch.startX;
        const deltaY = touch.currentY - touch.startY;

        // ドラッグ開始の閾値（10px以上の移動）
        if (!this.dragState.isDragging && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
            this.dragState.isDragging = true;
            this.startVisualDrag();
        }

        if (this.dragState.isDragging) {
            // 付箋の位置を更新
            const newX = touch.currentX - this.dragState.startOffset.x;
            const newY = touch.currentY - this.dragState.startOffset.y;
            
            this.updateNotePosition(this.dragState.noteId, newX, newY);
        }
    }

    private startVisualDrag(): void {
        if (!this.dragState) return;

        const element = this.dragState.element;
        
        // ドラッグ中の視覚効果
        element.classList.add('dragging');
        element.style.transform += ' scale(1.1)';
        element.style.zIndex = '1000';
        
        // ハプティックフィードバック（対応デバイスのみ）
        if ('vibrate' in navigator) {
            navigator.vibrate(50);
        }
    }

    // ピンチジェスチャー（ズーム）
    private initiatePinchOperation(event: TouchEvent): void {
        const touches = Array.from(this.activeTouches.values());
        if (touches.length !== 2) return;

        const distance = this.calculateDistance(touches[0], touches[1]);
        const center = this.calculateCenter(touches[0], touches[1]);

        this.pinchState = {
            initialDistance: distance,
            currentDistance: distance,
            center: center,
            initialScale: this.getCurrentCanvasScale()
        };
    }

    private updatePinchOperation(): void {
        if (!this.pinchState) return;

        const touches = Array.from(this.activeTouches.values());
        if (touches.length !== 2) return;

        const currentDistance = this.calculateDistance(touches[0], touches[1]);
        const scaleRatio = currentDistance / this.pinchState.initialDistance;
        const newScale = this.pinchState.initialScale * scaleRatio;

        // ズーム範囲の制限
        const clampedScale = Math.max(0.5, Math.min(3.0, newScale));
        
        this.updateCanvasScale(clampedScale, this.pinchState.center);
        this.pinchState.currentDistance = currentDistance;
    }

    // タッチ終了処理
    private handleTouchEnd(event: TouchEvent): void {
        Array.from(event.changedTouches).forEach(touch => {
            this.activeTouches.delete(touch.identifier);
        });

        // ドラッグ終了
        if (this.dragState && this.activeTouches.size === 0) {
            this.finalizeDragOperation();
            this.dragState = null;
        }

        // ピンチ終了
        if (this.pinchState && this.activeTouches.size < 2) {
            this.pinchState = null;
        }

        // タップ判定（短時間で小さな移動の場合）
        if (this.activeTouches.size === 0) {
            this.checkForTapGesture(event);
        }
    }

    private checkForTapGesture(event: TouchEvent): void {
        const touch = event.changedTouches[0];
        const touchInfo = this.getCompletedTouchInfo(touch.identifier);
        
        if (touchInfo) {
            const duration = Date.now() - touchInfo.startTime;
            const distance = Math.sqrt(
                Math.pow(touchInfo.currentX - touchInfo.startX, 2) +
                Math.pow(touchInfo.currentY - touchInfo.startY, 2)
            );

            // タップと判定（300ms以内、10px以内の移動）
            if (duration < 300 && distance < 10) {
                this.handleTap(touchInfo);
            }
        }
    }

    private handleTap(touchInfo: TouchInfo): void {
        const targetNote = this.findNoteElement(touchInfo.target);
        
        if (targetNote) {
            // 付箋のタップ → 編集モードに切り替え
            this.enterNoteEditMode(targetNote.dataset.noteId!);
        } else {
            // 空白領域のタップ → 新しい付箋作成
            this.createNoteAtPosition(touchInfo.currentX, touchInfo.currentY);
        }
    }
}

interface TouchInfo {
    id: number;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    startTime: number;
    target: HTMLElement;
}

interface DragState {
    noteId: string;
    element: HTMLElement;
    startOffset: { x: number; y: number };
    isDragging: boolean;
}

interface PinchState {
    initialDistance: number;
    currentDistance: number;
    center: { x: number; y: number };
    initialScale: number;
}
```

### 3.2 レスポンシブUI設計

#### 画面サイズ適応システム
```typescript
export class ResponsiveManager {
    private breakpoints = {
        mobile: 768,
        tablet: 1024,
        desktop: 1200
    };

    private currentBreakpoint: string = 'desktop';

    constructor(private container: HTMLElement) {
        this.setupResponsiveListeners();
        this.updateLayoutForCurrentScreen();
    }

    private setupResponsiveListeners(): void {
        // 画面回転・リサイズの監視
        window.addEventListener('resize', this.debounce(this.handleResize.bind(this), 100));
        window.addEventListener('orientationchange', this.handleOrientationChange.bind(this));
        
        // ビューポートメタタグの動的調整
        this.adjustViewportMeta();
    }

    private handleResize(): void {
        const newBreakpoint = this.determineBreakpoint();
        
        if (newBreakpoint !== this.currentBreakpoint) {
            this.currentBreakpoint = newBreakpoint;
            this.applyBreakpointStyles();
            this.adjustUIForBreakpoint();
        }

        this.updateCanvasSize();
        this.redistributeNotesIfNeeded();
    }

    private adjustUIForBreakpoint(): void {
        switch (this.currentBreakpoint) {
            case 'mobile':
                this.enableMobileUI();
                break;
            case 'tablet':
                this.enableTabletUI();
                break;
            case 'desktop':
                this.enableDesktopUI();
                break;
        }
    }

    private enableMobileUI(): void {
        // モバイル専用UI調整
        const controls = this.container.querySelector('.postodo-controls');
        if (controls) {
            controls.classList.add('mobile-layout');
            
            // 縦並びレイアウト
            const inputContainer = controls.querySelector('.input-container');
            if (inputContainer) {
                inputContainer.classList.add('vertical-layout');
            }
        }

        // 付箋サイズの調整
        this.adjustNoteSizesForMobile();
        
        // フォントサイズの調整
        this.adjustFontSizesForMobile();
        
        // タッチターゲットサイズの調整（最小44px）
        this.adjustTouchTargets();
    }

    private adjustNoteSizesForMobile(): void {
        const notes = this.container.querySelectorAll('.sticky-note');
        notes.forEach(note => {
            const element = note as HTMLElement;
            
            // モバイルでは最小サイズを確保
            const currentSize = element.classList.contains('small') ? 'small' :
                              element.classList.contains('large') ? 'large' : 'medium';
            
            switch (currentSize) {
                case 'small':
                    element.style.width = '140px';
                    element.style.height = '140px';
                    break;
                case 'medium':
                    element.style.width = '180px';
                    element.style.height = '160px';
                    break;
                case 'large':
                    element.style.width = '220px';
                    element.style.height = '200px';
                    break;
            }
        });
    }

    private adjustTouchTargets(): void {
        // すべてのインタラクティブ要素が44px以上になるよう調整
        const interactiveElements = this.container.querySelectorAll('button, .note-btn, .menu-item');
        
        interactiveElements.forEach(element => {
            const el = element as HTMLElement;
            const rect = el.getBoundingClientRect();
            
            if (rect.width < 44 || rect.height < 44) {
                el.style.minWidth = '44px';
                el.style.minHeight = '44px';
                el.style.padding = '8px';
            }
        });
    }

    // デバイス機能の検出と最適化
    private optimizeForDevice(): void {
        // タッチサポート検出
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        
        if (isTouchDevice) {
            this.container.classList.add('touch-device');
            
            // ホバーエフェクトを無効化
            this.disableHoverEffects();
            
            // タッチ専用のインタラクションを有効化
            this.enableTouchInteractions();
        }

        // デバイスメモリの検出（可能な場合）
        if ('deviceMemory' in navigator) {
            const deviceMemory = (navigator as any).deviceMemory;
            
            if (deviceMemory < 4) {
                // 低メモリデバイス用の最適化
                this.enableLowMemoryMode();
            }
        }

        // ネットワーク状況の検出
        if ('connection' in navigator) {
            const connection = (navigator as any).connection;
            
            if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
                this.enableLowBandwidthMode();
            }
        }
    }

    private enableLowMemoryMode(): void {
        // アニメーションを簡略化
        this.container.classList.add('low-memory-mode');
        
        // 仮想化をより積極的に適用
        this.updateVirtualizationSettings({
            maxRenderedNotes: 20,
            renderMargin: '25px'
        });
    }
}
```

### 3.3 モバイル専用機能

#### スワイプジェスチャー・コンテキストメニュー
```typescript
export class MobileGestureHandler {
    private swipeThreshold = 50;
    private swipeTimeout = 300;

    setupSwipeGestures(noteElement: HTMLElement, noteId: string): void {
        let startX: number, startY: number, startTime: number;

        noteElement.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            startX = touch.clientX;
            startY = touch.clientY;
            startTime = Date.now();
        }, { passive: true });

        noteElement.addEventListener('touchend', (e) => {
            const touch = e.changedTouches[0];
            const endX = touch.clientX;
            const endY = touch.clientY;
            const endTime = Date.now();

            const deltaX = endX - startX;
            const deltaY = endY - startY;
            const deltaTime = endTime - startTime;

            // スワイプ判定
            if (deltaTime < this.swipeTimeout && Math.abs(deltaX) > this.swipeThreshold) {
                if (Math.abs(deltaX) > Math.abs(deltaY) * 2) { // 水平スワイプ
                    if (deltaX > 0) {
                        this.handleSwipeRight(noteId);
                    } else {
                        this.handleSwipeLeft(noteId);
                    }
                }
            }
        }, { passive: true });
    }

    private handleSwipeLeft(noteId: string): void {
        // 左スワイプ → 削除アクション
        this.showDeleteConfirmation(noteId);
    }

    private handleSwipeRight(noteId: string): void {
        // 右スワイプ → アーカイブアクション
        this.archiveNote(noteId);
    }

    // 長押しコンテキストメニュー
    setupLongPressMenu(noteElement: HTMLElement, noteId: string): void {
        let longPressTimer: NodeJS.Timeout;
        let isLongPress = false;

        noteElement.addEventListener('touchstart', (e) => {
            isLongPress = false;
            longPressTimer = setTimeout(() => {
                isLongPress = true;
                this.showContextMenu(e, noteId);
                
                // ハプティックフィードバック
                if ('vibrate' in navigator) {
                    navigator.vibrate(100);
                }
            }, 500);
        }, { passive: true });

        noteElement.addEventListener('touchmove', () => {
            clearTimeout(longPressTimer);
        }, { passive: true });

        noteElement.addEventListener('touchend', () => {
            clearTimeout(longPressTimer);
        }, { passive: true });
    }

    private showContextMenu(event: TouchEvent, noteId: string): void {
        const menu = document.createElement('div');
        menu.className = 'mobile-context-menu';
        
        const actions = [
            { icon: '🎨', text: '色を変更', action: () => this.changeColor(noteId) },
            { icon: '📏', text: 'サイズ変更', action: () => this.changeSize(noteId) },
            { icon: '📋', text: 'コピー', action: () => this.copyNote(noteId) },
            { icon: '🗑️', text: '削除', action: () => this.deleteNote(noteId) }
        ];

        actions.forEach(actionItem => {
            const item = document.createElement('div');
            item.className = 'context-menu-item';
            item.innerHTML = `<span class="icon">${actionItem.icon}</span><span>${actionItem.text}</span>`;
            item.addEventListener('click', () => {
                actionItem.action();
                this.hideContextMenu();
            });
            menu.appendChild(item);
        });

        // 位置調整
        const touch = event.touches[0];
        menu.style.position = 'fixed';
        menu.style.left = `${touch.clientX}px`;
        menu.style.top = `${touch.clientY}px`;

        document.body.appendChild(menu);

        // 外部クリックで閉じる
        setTimeout(() => {
            document.addEventListener('click', this.hideContextMenu, { once: true });
        }, 100);
    }
}
```

この高度技術設計により、Postodoプラグインは以下を実現できます：

🔄 **堅牢なリアルタイム同期** - 競合解決・順序保証
⚡ **大量データ対応** - 1000+付箋でも滑らか動作  
📱 **優れたモバイルUX** - ネイティブアプリ並みの操作感

次はこれらの設計を基に、具体的な実装計画を立てるか、特定の技術要素についてさらに詳しく検討したいでしょうか？