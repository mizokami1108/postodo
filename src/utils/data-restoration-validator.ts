import { StickyNote, Position, Dimensions, Appearance, NoteColor, NoteSize } from '../types/core-types';

/**
 * Canvas境界の定義
 */
export interface CanvasBounds {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
}

/**
 * デフォルトのCanvas境界
 */
export const DEFAULT_CANVAS_BOUNDS: CanvasBounds = {
    minX: 0,
    maxX: 10000,
    minY: 0,
    maxY: 10000
};

/**
 * デフォルト値の定義
 */
export const DEFAULT_VALUES = {
    position: { x: 100, y: 100, zIndex: 1 } as Position,
    dimensions: { width: 200, height: 180 } as Dimensions,
    appearance: {
        color: 'yellow' as NoteColor,
        size: 'medium' as NoteSize,
        rotation: 0
    } as Appearance
};

/**
 * 検証結果
 */
export interface ValidationResult {
    isValid: boolean;
    correctedValue: any;
    warnings: string[];
}

/**
 * データ復元時の整合性検証を行うバリデーター
 * 
 * Requirements 11.2, 11.3:
 * - 付箋を復元する際、データの整合性を検証し無効な位置を修正する
 * - Note_Fileに無効なデータが含まれている場合、デフォルト値を適用し警告をログに記録する
 */
export class DataRestorationValidator {
    private canvasBounds: CanvasBounds;

    constructor(canvasBounds: CanvasBounds = DEFAULT_CANVAS_BOUNDS) {
        this.canvasBounds = canvasBounds;
    }

    /**
     * Canvas境界を更新する
     */
    setCanvasBounds(bounds: CanvasBounds): void {
        this.canvasBounds = bounds;
    }

    /**
     * 位置データを検証し、必要に応じて修正する
     * 
     * @param position 検証する位置データ
     * @param noteId ログ用のノートID
     * @returns 検証結果と修正された位置データ
     */
    validatePosition(position: any, noteId?: string): ValidationResult {
        const warnings: string[] = [];
        let correctedPosition: Position = { ...DEFAULT_VALUES.position };
        let isValid = true;

        // positionがnullまたはundefinedの場合
        if (position === null || position === undefined) {
            warnings.push(`Position is missing${noteId ? ` for note ${noteId}` : ''}, using default values`);
            return { isValid: false, correctedValue: correctedPosition, warnings };
        }

        // positionがオブジェクトでない場合
        if (typeof position !== 'object') {
            warnings.push(`Position is not an object${noteId ? ` for note ${noteId}` : ''}, using default values`);
            return { isValid: false, correctedValue: correctedPosition, warnings };
        }

        // x座標の検証
        if (typeof position.x !== 'number' || isNaN(position.x)) {
            warnings.push(`Invalid x coordinate${noteId ? ` for note ${noteId}` : ''}: ${position.x}, using default`);
            correctedPosition.x = DEFAULT_VALUES.position.x;
            isValid = false;
        } else if (position.x < this.canvasBounds.minX) {
            warnings.push(`x coordinate ${position.x} is below minimum${noteId ? ` for note ${noteId}` : ''}, clamping to ${this.canvasBounds.minX}`);
            correctedPosition.x = this.canvasBounds.minX;
            isValid = false;
        } else if (position.x > this.canvasBounds.maxX) {
            warnings.push(`x coordinate ${position.x} exceeds maximum${noteId ? ` for note ${noteId}` : ''}, clamping to ${this.canvasBounds.maxX}`);
            correctedPosition.x = this.canvasBounds.maxX;
            isValid = false;
        } else {
            correctedPosition.x = position.x;
        }

        // y座標の検証
        if (typeof position.y !== 'number' || isNaN(position.y)) {
            warnings.push(`Invalid y coordinate${noteId ? ` for note ${noteId}` : ''}: ${position.y}, using default`);
            correctedPosition.y = DEFAULT_VALUES.position.y;
            isValid = false;
        } else if (position.y < this.canvasBounds.minY) {
            warnings.push(`y coordinate ${position.y} is below minimum${noteId ? ` for note ${noteId}` : ''}, clamping to ${this.canvasBounds.minY}`);
            correctedPosition.y = this.canvasBounds.minY;
            isValid = false;
        } else if (position.y > this.canvasBounds.maxY) {
            warnings.push(`y coordinate ${position.y} exceeds maximum${noteId ? ` for note ${noteId}` : ''}, clamping to ${this.canvasBounds.maxY}`);
            correctedPosition.y = this.canvasBounds.maxY;
            isValid = false;
        } else {
            correctedPosition.y = position.y;
        }

        // zIndex の検証
        if (typeof position.zIndex !== 'number' || isNaN(position.zIndex) || position.zIndex < 0) {
            warnings.push(`Invalid zIndex${noteId ? ` for note ${noteId}` : ''}: ${position.zIndex}, using default`);
            correctedPosition.zIndex = DEFAULT_VALUES.position.zIndex;
            isValid = false;
        } else {
            correctedPosition.zIndex = position.zIndex;
        }

        return { isValid, correctedValue: correctedPosition, warnings };
    }

    /**
     * 寸法データを検証し、必要に応じて修正する
     */
    validateDimensions(dimensions: any, noteId?: string): ValidationResult {
        const warnings: string[] = [];
        let correctedDimensions: Dimensions = { ...DEFAULT_VALUES.dimensions };
        let isValid = true;

        // dimensionsがnullまたはundefinedの場合
        if (dimensions === null || dimensions === undefined) {
            warnings.push(`Dimensions is missing${noteId ? ` for note ${noteId}` : ''}, using default values`);
            return { isValid: false, correctedValue: correctedDimensions, warnings };
        }

        // dimensionsがオブジェクトでない場合
        if (typeof dimensions !== 'object') {
            warnings.push(`Dimensions is not an object${noteId ? ` for note ${noteId}` : ''}, using default values`);
            return { isValid: false, correctedValue: correctedDimensions, warnings };
        }

        // 幅の検証
        if (typeof dimensions.width !== 'number' || isNaN(dimensions.width) || dimensions.width <= 0) {
            warnings.push(`Invalid width${noteId ? ` for note ${noteId}` : ''}: ${dimensions.width}, using default`);
            correctedDimensions.width = DEFAULT_VALUES.dimensions.width;
            isValid = false;
        } else {
            correctedDimensions.width = dimensions.width;
        }

        // 高さの検証
        if (typeof dimensions.height !== 'number' || isNaN(dimensions.height) || dimensions.height <= 0) {
            warnings.push(`Invalid height${noteId ? ` for note ${noteId}` : ''}: ${dimensions.height}, using default`);
            correctedDimensions.height = DEFAULT_VALUES.dimensions.height;
            isValid = false;
        } else {
            correctedDimensions.height = dimensions.height;
        }

        return { isValid, correctedValue: correctedDimensions, warnings };
    }

    /**
     * 外観データを検証し、必要に応じて修正する
     */
    validateAppearance(appearance: any, noteId?: string): ValidationResult {
        const warnings: string[] = [];
        let correctedAppearance: Appearance = { ...DEFAULT_VALUES.appearance };
        let isValid = true;

        const validColors: NoteColor[] = ['yellow', 'pink', 'blue', 'green', 'orange', 'purple'];
        const validSizes: NoteSize[] = ['small', 'medium', 'large'];

        // appearanceがnullまたはundefinedの場合
        if (appearance === null || appearance === undefined) {
            warnings.push(`Appearance is missing${noteId ? ` for note ${noteId}` : ''}, using default values`);
            return { isValid: false, correctedValue: correctedAppearance, warnings };
        }

        // appearanceがオブジェクトでない場合
        if (typeof appearance !== 'object') {
            warnings.push(`Appearance is not an object${noteId ? ` for note ${noteId}` : ''}, using default values`);
            return { isValid: false, correctedValue: correctedAppearance, warnings };
        }

        // 色の検証
        if (!validColors.includes(appearance.color)) {
            warnings.push(`Invalid color${noteId ? ` for note ${noteId}` : ''}: ${appearance.color}, using default`);
            correctedAppearance.color = DEFAULT_VALUES.appearance.color;
            isValid = false;
        } else {
            correctedAppearance.color = appearance.color;
        }

        // サイズの検証
        if (!validSizes.includes(appearance.size)) {
            warnings.push(`Invalid size${noteId ? ` for note ${noteId}` : ''}: ${appearance.size}, using default`);
            correctedAppearance.size = DEFAULT_VALUES.appearance.size;
            isValid = false;
        } else {
            correctedAppearance.size = appearance.size;
        }

        // 回転の検証
        if (typeof appearance.rotation !== 'number' || isNaN(appearance.rotation)) {
            warnings.push(`Invalid rotation${noteId ? ` for note ${noteId}` : ''}: ${appearance.rotation}, using default`);
            correctedAppearance.rotation = DEFAULT_VALUES.appearance.rotation;
            isValid = false;
        } else {
            correctedAppearance.rotation = appearance.rotation;
        }

        return { isValid, correctedValue: correctedAppearance, warnings };
    }

    /**
     * StickyNoteの全データを検証し、必要に応じて修正する
     * 
     * @param note 検証するStickyNote
     * @returns 検証・修正されたStickyNoteと警告メッセージ
     */
    validateAndCorrectNote(note: Partial<StickyNote>): { note: StickyNote; warnings: string[] } {
        const allWarnings: string[] = [];
        const noteId = note.id || 'unknown';

        // 位置の検証
        const positionResult = this.validatePosition(note.position, noteId);
        if (!positionResult.isValid) {
            allWarnings.push(...positionResult.warnings);
        }

        // 寸法の検証
        const dimensionsResult = this.validateDimensions(note.dimensions, noteId);
        if (!dimensionsResult.isValid) {
            allWarnings.push(...dimensionsResult.warnings);
        }

        // 外観の検証
        const appearanceResult = this.validateAppearance(note.appearance, noteId);
        if (!appearanceResult.isValid) {
            allWarnings.push(...appearanceResult.warnings);
        }

        // 修正されたノートを構築
        const correctedNote: StickyNote = {
            id: note.id || `note-${Date.now()}`,
            filePath: note.filePath || '',
            title: note.title || '',
            content: note.content || '',
            position: positionResult.correctedValue,
            dimensions: dimensionsResult.correctedValue,
            appearance: appearanceResult.correctedValue,
            metadata: note.metadata || {
                created: new Date().toISOString(),
                modified: new Date().toISOString(),
                tags: ['postodo'],
                links: [],
                attachments: []
            },
            completed: note.completed || false
        };

        // 警告をログに記録
        if (allWarnings.length > 0) {
            console.warn(`[DataRestorationValidator] Validation warnings for note ${noteId}:`, allWarnings);
        }

        return { note: correctedNote, warnings: allWarnings };
    }

    /**
     * 位置がCanvas境界内にあるかどうかを確認する
     */
    isPositionWithinBounds(position: Position): boolean {
        return (
            position.x >= this.canvasBounds.minX &&
            position.x <= this.canvasBounds.maxX &&
            position.y >= this.canvasBounds.minY &&
            position.y <= this.canvasBounds.maxY
        );
    }

    /**
     * 位置をCanvas境界内にクランプする
     */
    clampPositionToBounds(position: Position): Position {
        return {
            x: Math.max(this.canvasBounds.minX, Math.min(this.canvasBounds.maxX, position.x)),
            y: Math.max(this.canvasBounds.minY, Math.min(this.canvasBounds.maxY, position.y)),
            zIndex: Math.max(0, position.zIndex)
        };
    }
}
