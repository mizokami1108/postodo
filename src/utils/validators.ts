import { StickyNote, Position, Dimensions, CreateNoteOptions } from '../types/core-types';

export interface ValidationResult {
    valid: boolean;
    error?: string;
    suggestions?: string[];
}

export class NoteValidator {
    static readonly MAX_CONTENT_LENGTH = 1000;
    static readonly MIN_CONTENT_LENGTH = 1;
    static readonly MAX_NOTE_SIZE = 500;
    static readonly MIN_NOTE_SIZE = 100;

    static validateContent(content: string): ValidationResult {
        if (typeof content !== 'string') {
            return {
                valid: false,
                error: 'コンテンツは文字列である必要があります'
            };
        }

        const trimmedContent = content.trim();
        
        if (trimmedContent.length < this.MIN_CONTENT_LENGTH) {
            return {
                valid: false,
                error: '付箋の内容を入力してください',
                suggestions: ['1文字以上の内容を入力してください']
            };
        }

        if (trimmedContent.length > this.MAX_CONTENT_LENGTH) {
            return {
                valid: false,
                error: `付箋の内容が長すぎます（${trimmedContent.length}/${this.MAX_CONTENT_LENGTH}文字）`,
                suggestions: ['内容を短くしてください', '複数の付箋に分けることを検討してください']
            };
        }

        // 危険なタグの検出
        const dangerousPatterns = [
            /<script[^>]*>.*?<\/script>/gi,
            /<iframe[^>]*>.*?<\/iframe>/gi,
            /javascript:/gi,
            /on\w+\s*=/gi
        ];

        for (const pattern of dangerousPatterns) {
            if (pattern.test(content)) {
                return {
                    valid: false,
                    error: '安全でないコンテンツが含まれています',
                    suggestions: ['HTMLタグやスクリプトを削除してください']
                };
            }
        }

        return { valid: true };
    }

    static validatePosition(position: Position): ValidationResult {
        if (!position || typeof position !== 'object') {
            return {
                valid: false,
                error: '位置情報が無効です'
            };
        }

        const { x, y, zIndex } = position;

        if (typeof x !== 'number' || typeof y !== 'number') {
            return {
                valid: false,
                error: 'X座標とY座標は数値である必要があります'
            };
        }

        if (x < 0 || y < 0) {
            return {
                valid: false,
                error: '座標は0以上である必要があります',
                suggestions: ['座標を正の値に設定してください']
            };
        }

        if (x > 10000 || y > 10000) {
            return {
                valid: false,
                error: '座標が大きすぎます',
                suggestions: ['座標を10000以下に設定してください']
            };
        }

        if (typeof zIndex !== 'number' || zIndex < 0) {
            return {
                valid: false,
                error: 'Z-indexは0以上の数値である必要があります'
            };
        }

        return { valid: true };
    }

    static validateDimensions(dimensions: Dimensions): ValidationResult {
        if (!dimensions || typeof dimensions !== 'object') {
            return {
                valid: false,
                error: 'サイズ情報が無効です'
            };
        }

        const { width, height } = dimensions;

        if (typeof width !== 'number' || typeof height !== 'number') {
            return {
                valid: false,
                error: '幅と高さは数値である必要があります'
            };
        }

        if (width < this.MIN_NOTE_SIZE || height < this.MIN_NOTE_SIZE) {
            return {
                valid: false,
                error: `付箋が小さすぎます（最小: ${this.MIN_NOTE_SIZE}px）`,
                suggestions: [`幅と高さを${this.MIN_NOTE_SIZE}px以上に設定してください`]
            };
        }

        if (width > this.MAX_NOTE_SIZE || height > this.MAX_NOTE_SIZE) {
            return {
                valid: false,
                error: `付箋が大きすぎます（最大: ${this.MAX_NOTE_SIZE}px）`,
                suggestions: [`幅と高さを${this.MAX_NOTE_SIZE}px以下に設定してください`]
            };
        }

        return { valid: true };
    }

    static validateCreateNoteOptions(options: CreateNoteOptions): ValidationResult {
        if (!options || typeof options !== 'object') {
            return {
                valid: false,
                error: '付箋作成オプションが無効です'
            };
        }

        // コンテンツの検証
        const contentValidation = this.validateContent(options.content);
        if (!contentValidation.valid) {
            return contentValidation;
        }

        // 位置の検証（指定されている場合）
        if (options.position) {
            const positionValidation = this.validatePosition(options.position);
            if (!positionValidation.valid) {
                return positionValidation;
            }
        }

        // サイズの検証（指定されている場合）
        if (options.dimensions) {
            const dimensionsValidation = this.validateDimensions(options.dimensions);
            if (!dimensionsValidation.valid) {
                return dimensionsValidation;
            }
        }

        return { valid: true };
    }

    static validateNoteId(id: string): ValidationResult {
        if (typeof id !== 'string') {
            return {
                valid: false,
                error: 'IDは文字列である必要があります'
            };
        }

        if (id.length === 0) {
            return {
                valid: false,
                error: 'IDは空文字列にできません'
            };
        }

        // 有効な文字のみをチェック
        const validIdPattern = /^[a-zA-Z0-9_-]+$/;
        if (!validIdPattern.test(id)) {
            return {
                valid: false,
                error: 'IDには英数字、ハイフン、アンダースコアのみ使用できます'
            };
        }

        return { valid: true };
    }
}

export class FileValidator {
    static readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    static readonly ALLOWED_EXTENSIONS = ['.md', '.txt'];

    static validateFileName(fileName: string): ValidationResult {
        if (typeof fileName !== 'string') {
            return {
                valid: false,
                error: 'ファイル名は文字列である必要があります'
            };
        }

        if (fileName.length === 0) {
            return {
                valid: false,
                error: 'ファイル名は空文字列にできません'
            };
        }

        // 危険な文字のチェック
        const dangerousChars = /[<>:"/\\|?*]/;
        if (dangerousChars.test(fileName)) {
            return {
                valid: false,
                error: 'ファイル名に使用できない文字が含まれています',
                suggestions: ['<, >, :, ", /, \\, |, ?, * の文字を削除してください']
            };
        }

        // 拡張子のチェック
        const hasValidExtension = this.ALLOWED_EXTENSIONS.some(ext => 
            fileName.toLowerCase().endsWith(ext)
        );

        if (!hasValidExtension) {
            return {
                valid: false,
                error: 'サポートされていないファイル拡張子です',
                suggestions: [`許可されている拡張子: ${this.ALLOWED_EXTENSIONS.join(', ')}`]
            };
        }

        return { valid: true };
    }

    static validateFilePath(filePath: string): ValidationResult {
        if (typeof filePath !== 'string') {
            return {
                valid: false,
                error: 'ファイルパスは文字列である必要があります'
            };
        }

        if (filePath.length === 0) {
            return {
                valid: false,
                error: 'ファイルパスは空文字列にできません'
            };
        }

        // 相対パスの検証
        if (filePath.includes('..')) {
            return {
                valid: false,
                error: 'ファイルパスに相対パス（..）は使用できません'
            };
        }

        // 絶対パスの検証（Windows/Unix対応）
        const isAbsolute = filePath.startsWith('/') || /^[A-Za-z]:/.test(filePath);
        if (isAbsolute) {
            return {
                valid: false,
                error: '絶対パスは使用できません',
                suggestions: ['相対パスを使用してください']
            };
        }

        return { valid: true };
    }
}

export class ConfigValidator {
    static validateSettingsValue(key: string, value: any): ValidationResult {
        switch (key) {
            case 'core.maxNotes':
                if (typeof value !== 'number' || value < 1 || value > 10000) {
                    return {
                        valid: false,
                        error: '最大付箋数は1から10000の間で設定してください'
                    };
                }
                break;

            case 'core.saveInterval':
                if (typeof value !== 'number' || value < 100 || value > 10000) {
                    return {
                        valid: false,
                        error: '保存間隔は100から10000ミリ秒の間で設定してください'
                    };
                }
                break;

            case 'rendering.maxRenderedNotes':
                if (typeof value !== 'number' || value < 10 || value > 1000) {
                    return {
                        valid: false,
                        error: '最大描画数は10から1000の間で設定してください'
                    };
                }
                break;

            case 'postodoFolder':
                if (typeof value !== 'string' || value.length === 0) {
                    return {
                        valid: false,
                        error: 'フォルダ名は空文字列にできません'
                    };
                }
                break;

            default:
                // 未知の設定キーは警告のみ
                console.warn(`Unknown setting key: ${key}`);
        }

        return { valid: true };
    }
}

// 統合バリデーター
export class PostodoValidator {
    static validateAll(data: any, type: 'note' | 'file' | 'config'): ValidationResult {
        switch (type) {
            case 'note':
                return NoteValidator.validateCreateNoteOptions(data);
            case 'file':
                return FileValidator.validateFileName(data);
            case 'config':
                return { valid: true }; // 設定は個別にバリデーション
            default:
                return {
                    valid: false,
                    error: '不明なバリデーションタイプです'
                };
        }
    }
}