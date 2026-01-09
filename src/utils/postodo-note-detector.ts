import { TFile } from 'obsidian';
import { StickyNote, NoteColor, NoteSize } from '../types/core-types';

export interface TaskInfo {
    isTask: boolean;
    completed: boolean;
    content: string;
    dueDate?: string;
    scheduledDate?: string;
    startDate?: string;
    recurrence?: string;
    priority?: 'highest' | 'high' | 'low';
    originalText: string;
}

export interface TaskMatch {
    fullMatch: string;
    checkbox: string;
    content: string;
    completed: boolean;
    line: number;
    startIndex: number;
    endIndex: number;
}

export interface PostodoNoteData {
    id: string;
    content: string;
    completed: boolean;
    position?: { x: number; y: number; zIndex: number };
    dimensions?: { width: number; height: number };
    appearance?: {
        color: NoteColor;
        size: NoteSize;
        rotation: number;
    };
}

export class PostodoNoteDetector {

    static TASK_PATTERNS = {
        CHECKBOX: /^(\s*)([-*]|\d+\.)\s+(\[[ xX]\])\s+(.*)$/,
        DUE_DATE: /📅\s*(\d{4}-\d{2}-\d{2})/,
        SCHEDULED_DATE: /⏳\s*(\d{4}-\d{2}-\d{2})/,
        START_DATE: /🛫\s*(\d{4}-\d{2}-\d{2})/,
        RECURRENCE: /🔁\s*([^\s]+)/,
        PRIORITY_HIGHEST: /⏫/,
        PRIORITY_HIGH: /🔼/,
        PRIORITY_LOW: /🔽/
    };

    static detectTasksInContent(content: string): TaskMatch[] {
        const lines = content.split('\n');
        const tasks: TaskMatch[] = [];
        let currentIndex = 0;

        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const line = lines[lineIndex];
            const taskMatch = this.TASK_PATTERNS.CHECKBOX.exec(line);
            
            if (taskMatch) {
                const [fullMatch, indent, bullet, checkbox, taskContent] = taskMatch;
                const completed = checkbox.toLowerCase().includes('x');
                
                tasks.push({
                    fullMatch,
                    checkbox,
                    content: taskContent.trim(),
                    completed,
                    line: lineIndex,
                    startIndex: currentIndex + line.indexOf(taskMatch[0]),
                    endIndex: currentIndex + line.indexOf(taskMatch[0]) + taskMatch[0].length
                });
            }
            
            currentIndex += line.length + 1; // +1 for newline
        }
        
        return tasks;
    }

    static parseTaskInfo(taskText: string): TaskInfo {
        const isTask = this.TASK_PATTERNS.CHECKBOX.test(taskText);
        
        if (!isTask) {
            return {
                isTask: false,
                completed: false,
                content: taskText,
                originalText: taskText
            };
        }

        const match = this.TASK_PATTERNS.CHECKBOX.exec(taskText);
        if (!match) {
            return {
                isTask: false,
                completed: false,
                content: taskText,
                originalText: taskText
            };
        }

        const [, , , checkbox, content] = match;
        const completed = checkbox.toLowerCase().includes('x');
        
        // Extract task metadata
        const dueMatch = this.TASK_PATTERNS.DUE_DATE.exec(content);
        const scheduledMatch = this.TASK_PATTERNS.SCHEDULED_DATE.exec(content);
        const startMatch = this.TASK_PATTERNS.START_DATE.exec(content);
        const recurrenceMatch = this.TASK_PATTERNS.RECURRENCE.exec(content);
        
        let priority: 'highest' | 'high' | 'low' | undefined;
        if (this.TASK_PATTERNS.PRIORITY_HIGHEST.test(content)) {
            priority = 'highest';
        } else if (this.TASK_PATTERNS.PRIORITY_HIGH.test(content)) {
            priority = 'high';
        } else if (this.TASK_PATTERNS.PRIORITY_LOW.test(content)) {
            priority = 'low';
        }

        // Clean content by removing emoji metadata
        let cleanContent = content
            .replace(this.TASK_PATTERNS.DUE_DATE, '')
            .replace(this.TASK_PATTERNS.SCHEDULED_DATE, '')
            .replace(this.TASK_PATTERNS.START_DATE, '')
            .replace(this.TASK_PATTERNS.RECURRENCE, '')
            .replace(this.TASK_PATTERNS.PRIORITY_HIGHEST, '')
            .replace(this.TASK_PATTERNS.PRIORITY_HIGH, '')
            .replace(this.TASK_PATTERNS.PRIORITY_LOW, '')
            .trim();

        return {
            isTask: true,
            completed,
            content: cleanContent,
            dueDate: dueMatch?.[1],
            scheduledDate: scheduledMatch?.[1],
            startDate: startMatch?.[1],
            recurrence: recurrenceMatch?.[1],
            priority,
            originalText: taskText
        };
    }

    static extractTasksFromFile(content: string, filePath: string): StickyNote[] {
        console.log(`[DEBUG] Extracting tasks from ${filePath}`);
        
        const tasks = this.detectTasksInContent(content);
        const stickyNotes: StickyNote[] = [];
        
        tasks.forEach((task, index) => {
            const taskInfo = this.parseTaskInfo(task.fullMatch);
            
            if (taskInfo.isTask) {
                const noteId = this.generateTaskId(filePath, task.line);
                const now = new Date().toISOString();
                
                // Determine note color based on priority
                let color: NoteColor = 'yellow';
                if (taskInfo.priority === 'highest') color = 'pink';
                else if (taskInfo.priority === 'high') color = 'orange';
                else if (taskInfo.priority === 'low') color = 'blue';
                
                const stickyNote: StickyNote = {
                    id: noteId,
                    filePath: filePath,
                    content: taskInfo.content,
                    position: {
                        x: 50 + (index % 5) * 220,
                        y: 50 + Math.floor(index / 5) * 200,
                        zIndex: 1
                    },
                    dimensions: { width: 200, height: 180 },
                    appearance: {
                        color,
                        size: 'medium' as NoteSize,
                        rotation: 0
                    },
                    metadata: {
                        created: now,
                        modified: now,
                        tags: ['postodo', 'task'],
                        links: [],
                        attachments: [],
                        taskInfo: {
                            dueDate: taskInfo.dueDate,
                            scheduledDate: taskInfo.scheduledDate,
                            startDate: taskInfo.startDate,
                            recurrence: taskInfo.recurrence,
                            priority: taskInfo.priority,
                            lineNumber: task.line
                        }
                    },
                    completed: taskInfo.completed
                };
                
                stickyNotes.push(stickyNote);
            }
        });
        
        console.log(`[DEBUG] Extracted ${stickyNotes.length} task notes from ${filePath}`);
        return stickyNotes;
    }
    
    static generateTaskId(filePath: string, lineNumber: number): string {
        const filename = filePath.split('/').pop()?.replace('.md', '') || 'unknown';
        return `task-${filename}-line${lineNumber}-${Date.now()}`;
    }

    static isTaskNote(note: StickyNote): boolean {
        return note.metadata.tags.includes('task');
    }

    static formatTaskContent(note: StickyNote): string {
        if (!this.isTaskNote(note)) {
            return note.content;
        }
        
        const taskInfo = note.metadata.taskInfo;
        if (!taskInfo) {
            return note.content;
        }
        
        let formatted = note.content;
        
        // Add emoji metadata
        if (taskInfo.dueDate) formatted += ` 📅 ${taskInfo.dueDate}`;
        if (taskInfo.scheduledDate) formatted += ` ⏳ ${taskInfo.scheduledDate}`;
        if (taskInfo.startDate) formatted += ` 🛫 ${taskInfo.startDate}`;
        if (taskInfo.recurrence) formatted += ` 🔁 ${taskInfo.recurrence}`;
        if (taskInfo.priority === 'highest') formatted += ' ⏫';
        else if (taskInfo.priority === 'high') formatted += ' 🔼';
        else if (taskInfo.priority === 'low') formatted += ' 🔽';
        
        return formatted;
    }

    static extractPostodoData(content: string, filePath: string): PostodoNoteData | null {
        console.log(`[DEBUG] Extracting postodo data from ${filePath}`);
        console.log(`[DEBUG] Content preview:`, content.substring(0, 200));
        
        try {
            const frontmatterMatch = content.match(/^---\n(.*?)\n---\n\n(.*)$/s);
            if (!frontmatterMatch) {
                console.log(`[DEBUG] No frontmatter found in ${filePath}`);
                return null;
            }

            const [, frontmatterText, bodyContent] = frontmatterMatch;
            const frontmatter: any = {};
            
            if (!frontmatterText || !frontmatterText.trim()) {
                console.log(`[DEBUG] Empty frontmatter in ${filePath}`);
                return null;
            }
            
            console.log(`[DEBUG] Found frontmatter in ${filePath}:`, frontmatterText);
            
            // frontmatterをパース
            const lines = frontmatterText.split('\n');
            let currentKey = null;
            let indentLevel = 0;
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const trimmedLine = line.trim();
                
                if (!trimmedLine) continue;
                
                // インデントレベルを計算
                const lineIndent = line.length - line.trimStart().length;
                
                // YAML配列のアイテムをチェック（インデント考慮）
                if (trimmedLine.startsWith('- ')) {
                    if (currentKey === 'tags') {
                        if (!frontmatter.tags) {
                            frontmatter.tags = [];
                        }
                        frontmatter.tags.push(trimmedLine.substring(2).trim());
                    }
                    continue;
                }
                
                // キー: 値のペアをチェック
                const colonIndex = trimmedLine.indexOf(':');
                if (colonIndex > 0) {
                    const key = trimmedLine.substring(0, colonIndex).trim();
                    const value = trimmedLine.substring(colonIndex + 1).trim();
                    
                    if (!key) continue;
                    
                    // インデントが0なら最上位のキー
                    if (lineIndent === 0) {
                        currentKey = key;
                        indentLevel = 0;
                        
                        if (value) {
                            // 値がある場合
                            try {
                                frontmatter[key] = JSON.parse(value);
                            } catch {
                                frontmatter[key] = value;
                            }
                        }
                    } else {
                        // ネストしたオブジェクトのプロパティ
                        if (currentKey && value) {
                            if (!frontmatter[currentKey]) {
                                frontmatter[currentKey] = {};
                            }
                            
                            try {
                                frontmatter[currentKey][key] = JSON.parse(value);
                            } catch {
                                frontmatter[currentKey][key] = value;
                            }
                        }
                    }
                }
            }

            console.log(`[DEBUG] Parsed frontmatter for ${filePath}:`, frontmatter);
            console.log(`[DEBUG] Tags in frontmatter:`, frontmatter.tags, typeof frontmatter.tags);
            
            // tagsにpostodoが含まれているかチェック
            if (!frontmatter.tags || !Array.isArray(frontmatter.tags) || !frontmatter.tags.includes('postodo')) {
                console.log(`[DEBUG] No postodo tag found in ${filePath}. Tags:`, frontmatter.tags);
                return null;
            }
            
            console.log(`[DEBUG] Found postodo tag in ${filePath}!`);

            // postodo固有のプロパティがあるかチェック
            const hasPostodoProperties = frontmatter.postodo_id || 
                                       frontmatter.postodo_position || 
                                       frontmatter.postodo_completed !== undefined;

            console.log(`[DEBUG] Has postodo properties in ${filePath}:`, hasPostodoProperties);
            if (!hasPostodoProperties) {
                console.log(`[DEBUG] No postodo properties found in ${filePath}`);
                return null;
            }

            const id = frontmatter.postodo_id || this.generateIdFromPath(filePath);

            const result = {
                id,
                content: bodyContent ? bodyContent.trim() : '',
                completed: frontmatter.postodo_completed || false,
                position: frontmatter.postodo_position,
                dimensions: frontmatter.postodo_dimensions,
                appearance: frontmatter.postodo_appearance ? this.validateAppearance(frontmatter.postodo_appearance) : undefined
            };
            
            console.log(`[DEBUG] Successfully extracted postodo data from ${filePath}:`, result);
            return result;
        } catch (error) {
            console.error('Error extracting postodo data from:', filePath, error);
            return null;
        }
    }

    static toStickyNote(data: PostodoNoteData, filePath: string): StickyNote {
        const now = new Date().toISOString();
        
        return {
            id: data.id,
            filePath,
            content: data.content,
            position: data.position || { x: 100, y: 100, zIndex: 1 },
            dimensions: data.dimensions || { width: 200, height: 180 },
            appearance: data.appearance || {
                color: 'yellow' as NoteColor,
                size: 'medium' as NoteSize,
                rotation: 0
            },
            metadata: {
                created: now,
                modified: now,
                tags: ['postodo'],
                links: [],
                attachments: []
            },
            completed: data.completed
        };
    }

    static toFrontmatter(note: StickyNote): string {
        const frontmatter = {
            tags: note.metadata.tags,
            postodo_id: note.id,
            postodo_position: note.position,
            postodo_dimensions: note.dimensions,
            postodo_appearance: note.appearance,
            postodo_completed: note.completed
        };

        console.log(`[DEBUG] Creating frontmatter for ${note.id}:`, frontmatter);

        // YAML形式で生成
        let yamlContent = '';
        
        // tagsをYAML配列形式で処理
        if (frontmatter.tags && Array.isArray(frontmatter.tags)) {
            yamlContent += 'tags:\n';
            frontmatter.tags.forEach(tag => {
                yamlContent += `  - ${tag}\n`;
            });
        }
        
        // 他のプロパティを処理
        Object.entries(frontmatter).forEach(([key, value]) => {
            if (key === 'tags') return; // 既に処理済み
            
            if (typeof value === 'object' && value !== null) {
                yamlContent += `${key}:\n`;
                Object.entries(value).forEach(([subKey, subValue]) => {
                    yamlContent += `  ${subKey}: ${subValue}\n`;
                });
            } else {
                yamlContent += `${key}: ${value}\n`;
            }
        });

        const result = `---\n${yamlContent}---\n\n`;
        console.log(`[DEBUG] Generated frontmatter for ${note.id}:`, result.length, 'chars');
        return result;
    }

    static updateNoteContent(originalContent: string, note: StickyNote): string {
        console.log(`[DEBUG] Updating note content for ${note.id}`);
        const frontmatter = this.toFrontmatter(note);
        console.log(`[DEBUG] Generated frontmatter:`, frontmatter);
        
        let contentWithoutFrontmatter = originalContent;
        const frontmatterMatch = originalContent.match(/^---\n.*?\n---\n\n/s);
        if (frontmatterMatch) {
            contentWithoutFrontmatter = originalContent.substring(frontmatterMatch[0].length);
        }
        
        if (!contentWithoutFrontmatter.trim()) {
            contentWithoutFrontmatter = note.content;
        }

        const finalContent = frontmatter + contentWithoutFrontmatter.trim();
        console.log(`[DEBUG] Final content for ${note.id}:`, finalContent.substring(0, 200));
        return finalContent;
    }

    private static generateIdFromPath(filePath: string): string {
        const filename = filePath.split('/').pop()?.replace('.md', '') || 'unknown';
        return `note-${Date.now()}-${filename}`;
    }

    private static validateAppearance(appearance: any): { color: NoteColor; size: NoteSize; rotation: number } | undefined {
        if (!appearance || typeof appearance !== 'object') {
            return undefined;
        }

        const validColors: NoteColor[] = ['yellow', 'pink', 'blue', 'green', 'orange', 'purple'];
        const validSizes: NoteSize[] = ['small', 'medium', 'large'];
        
        const color = validColors.includes(appearance.color) ? appearance.color : 'yellow' as NoteColor;
        const size = validSizes.includes(appearance.size) ? appearance.size : 'medium' as NoteSize;
        const rotation = typeof appearance.rotation === 'number' ? appearance.rotation : 0;
        
        return { color, size, rotation };
    }
}