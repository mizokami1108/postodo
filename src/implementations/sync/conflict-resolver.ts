import { StickyNote, Position, NoteMetadata } from '../../types/core-types';
import {
    IConflictResolver,
    ConflictType,
    ResolveResult,
    ConflictDetectionResult,
    ResolveStrategy
} from '../../interfaces/sync/i-conflict-resolver';

/**
 * 競合解決の実装
 * 
 * 解決戦略:
 * - 位置競合: UI優先（ユーザーがドラッグ中の可能性があるため）
 * - コンテンツ競合: 新しい方優先
 * - メタデータ競合: 競合しないフィールドをマージ
 * 
 * Requirements: 8.1, 8.2, 8.3
 */
export class ConflictResolver implements IConflictResolver {
    /**
     * 位置が異なるかどうかを判定
     */
    private isPositionDifferent(pos1: Position, pos2: Position): boolean {
        return pos1.x !== pos2.x || pos1.y !== pos2.y || pos1.zIndex !== pos2.zIndex;
    }

    /**
     * コンテンツが異なるかどうかを判定
     */
    private isContentDifferent(note1: StickyNote, note2: StickyNote): boolean {
        return note1.title !== note2.title || note1.content !== note2.content;
    }

    /**
     * メタデータが異なるかどうかを判定（modified以外）
     */
    private isMetadataDifferent(meta1: NoteMetadata, meta2: NoteMetadata): boolean {
        // tagsの比較
        const tags1 = [...meta1.tags].sort();
        const tags2 = [...meta2.tags].sort();
        if (tags1.length !== tags2.length || !tags1.every((t, i) => t === tags2[i])) {
            return true;
        }

        // linksの比較
        const links1 = [...meta1.links].sort();
        const links2 = [...meta2.links].sort();
        if (links1.length !== links2.length || !links1.every((l, i) => l === links2[i])) {
            return true;
        }

        // attachmentsの比較
        const attachments1 = [...meta1.attachments].sort();
        const attachments2 = [...meta2.attachments].sort();
        if (attachments1.length !== attachments2.length || !attachments1.every((a, i) => a === attachments2[i])) {
            return true;
        }

        return false;
    }

    /**
     * 競合を検出する（最初に見つかった競合のみ）
     */
    detectConflict(fileNote: StickyNote, uiNote: StickyNote): ConflictType | null {
        // 同じIDでない場合は比較不可
        if (fileNote.id !== uiNote.id) {
            return null;
        }

        // 位置の競合をチェック
        if (this.isPositionDifferent(fileNote.position, uiNote.position)) {
            return 'position';
        }

        // コンテンツの競合をチェック
        if (this.isContentDifferent(fileNote, uiNote)) {
            return 'content';
        }

        // メタデータの競合をチェック
        if (this.isMetadataDifferent(fileNote.metadata, uiNote.metadata)) {
            return 'metadata';
        }

        return null;
    }

    /**
     * 全ての競合を検出する
     */
    detectAllConflicts(fileNote: StickyNote, uiNote: StickyNote): ConflictDetectionResult {
        const conflictTypes: ConflictType[] = [];

        // 同じIDでない場合は比較不可
        if (fileNote.id !== uiNote.id) {
            return { hasConflict: false, conflictTypes: [] };
        }

        // 位置の競合をチェック
        if (this.isPositionDifferent(fileNote.position, uiNote.position)) {
            conflictTypes.push('position');
        }

        // コンテンツの競合をチェック
        if (this.isContentDifferent(fileNote, uiNote)) {
            conflictTypes.push('content');
        }

        // メタデータの競合をチェック
        if (this.isMetadataDifferent(fileNote.metadata, uiNote.metadata)) {
            conflictTypes.push('metadata');
        }

        return {
            hasConflict: conflictTypes.length > 0,
            conflictTypes
        };
    }

    /**
     * 競合を解決する
     */
    async resolveConflict(
        fileNote: StickyNote,
        uiNote: StickyNote,
        conflictType: ConflictType
    ): Promise<ResolveResult> {
        let result: StickyNote;
        let strategy: ResolveStrategy;

        switch (conflictType) {
            case 'position':
                // 位置競合: UI優先（Requirements 8.1）
                result = this.resolvePositionConflict(fileNote, uiNote);
                strategy = 'ui-wins';
                break;

            case 'content':
                // コンテンツ競合: 新しい方優先（Requirements 8.2）
                result = this.resolveContentConflict(fileNote, uiNote);
                strategy = this.getNewerNote(fileNote, uiNote) === uiNote ? 'ui-wins' : 'file-wins';
                break;

            case 'metadata':
                // メタデータ競合: マージ（Requirements 8.3）
                result = this.resolveMetadataConflict(fileNote, uiNote);
                strategy = 'merge';
                break;

            default:
                // 競合タイプが不明な場合はUI優先
                result = uiNote;
                strategy = 'ui-wins';
        }

        return {
            success: true,
            result,
            strategy
        };
    }

    /**
     * 全ての競合を解決する
     */
    async resolveAllConflicts(
        fileNote: StickyNote,
        uiNote: StickyNote
    ): Promise<ResolveResult> {
        const detection = this.detectAllConflicts(fileNote, uiNote);

        if (!detection.hasConflict) {
            return {
                success: true,
                result: uiNote,
                strategy: 'ui-wins'
            };
        }

        // 全ての競合を順番に解決
        let resolvedNote = { ...uiNote };
        let finalStrategy: ResolveStrategy = 'merge';

        for (const conflictType of detection.conflictTypes) {
            const resolution = await this.resolveConflict(fileNote, resolvedNote, conflictType);
            resolvedNote = resolution.result;
        }

        return {
            success: true,
            result: resolvedNote,
            strategy: finalStrategy
        };
    }

    /**
     * 位置競合を解決（UI優先）
     */
    private resolvePositionConflict(fileNote: StickyNote, uiNote: StickyNote): StickyNote {
        // UI側の位置を優先
        return {
            ...fileNote,
            position: { ...uiNote.position },
            metadata: {
                ...fileNote.metadata,
                modified: new Date().toISOString()
            }
        };
    }

    /**
     * コンテンツ競合を解決（新しい方優先）
     */
    private resolveContentConflict(fileNote: StickyNote, uiNote: StickyNote): StickyNote {
        const newerNote = this.getNewerNote(fileNote, uiNote);
        
        return {
            ...fileNote,
            title: newerNote.title,
            content: newerNote.content,
            metadata: {
                ...fileNote.metadata,
                modified: new Date().toISOString()
            }
        };
    }

    /**
     * メタデータ競合を解決（マージ）
     */
    private resolveMetadataConflict(fileNote: StickyNote, uiNote: StickyNote): StickyNote {
        // タグをマージ（重複排除）
        const mergedTags = [...new Set([...fileNote.metadata.tags, ...uiNote.metadata.tags])];
        
        // リンクをマージ（重複排除）
        const mergedLinks = [...new Set([...fileNote.metadata.links, ...uiNote.metadata.links])];
        
        // 添付ファイルをマージ（重複排除）
        const mergedAttachments = [...new Set([...fileNote.metadata.attachments, ...uiNote.metadata.attachments])];

        return {
            ...uiNote,
            metadata: {
                ...uiNote.metadata,
                tags: mergedTags,
                links: mergedLinks,
                attachments: mergedAttachments,
                modified: new Date().toISOString()
            }
        };
    }

    /**
     * より新しい付箋を取得
     */
    private getNewerNote(fileNote: StickyNote, uiNote: StickyNote): StickyNote {
        const fileModified = new Date(fileNote.metadata.modified).getTime();
        const uiModified = new Date(uiNote.metadata.modified).getTime();
        
        return fileModified > uiModified ? fileNote : uiNote;
    }
}
