/**
 * 多言語対応のための翻訳定義
 */

export type Language = 'en' | 'ja';

export interface Translations {
    // Context Menu
    contextMenu: {
        openNote: string;
        edit: string;
        changeColor: string;
        changeSize: string;
        markComplete: string;
        markIncomplete: string;
        delete: string;
        copyFilename: string;
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
    // Tooltip
    tooltip: {
        filename: string;
    };
    // Action Bar
    actionBar: {
        complete: string;
        incomplete: string;
    };
    // Common (shared between context menu and settings)
    common: {
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
    // Settings Tab
    settings: {
        title: string;
        language: {
            name: string;
            desc: string;
        };
        basic: {
            title: string;
            notesFolder: {
                name: string;
                desc: string;
            };
            autoSave: {
                name: string;
                desc: string;
            };
            saveInterval: {
                name: string;
                desc: string;
            };
        };
        naming: {
            title: string;
            strategy: {
                name: string;
                desc: string;
                options: {
                    timestamp: string;
                    sequential: string;
                    custom: string;
                };
            };
        };
        displayFilter: {
            title: string;
            default: {
                name: string;
                desc: string;
                options: {
                    incomplete: string;
                    complete: string;
                    all: string;
                };
            };
        };
        rendering: {
            title: string;
            virtualization: {
                name: string;
                desc: string;
            };
            maxRenderedNotes: {
                name: string;
                desc: string;
            };
        };
        storage: {
            title: string;
            syncStrategy: {
                name: string;
                desc: string;
                options: {
                    realTime: string;
                    manual: string;
                    periodic: string;
                };
            };
            conflictResolution: {
                name: string;
                desc: string;
                options: {
                    autoMerge: string;
                    userChoice: string;
                    lastWriteWins: string;
                };
            };
        };
        ui: {
            title: string;
            showGrid: {
                name: string;
                desc: string;
            };
            snapToGrid: {
                name: string;
                desc: string;
            };
        };
        noteDefaults: {
            title: string;
            color: {
                name: string;
                desc: string;
            };
            size: {
                name: string;
                desc: string;
            };
        };
        advanced: {
            title: string;
            debugMode: {
                name: string;
                desc: string;
            };
            maxNotes: {
                name: string;
                desc: string;
            };
            clearData: {
                name: string;
                desc: string;
                button: string;
                confirmTitle: string;
                confirmMessage: string;
                cancel: string;
                confirm: string;
            };
        };
    };
}

export const translations: Record<Language, Translations> = {
    en: {
        contextMenu: {
            openNote: 'Open note',
            edit: 'Edit',
            changeColor: 'Change color',
            changeSize: 'Change size',
            markComplete: 'Mark complete',
            markIncomplete: 'Mark incomplete',
            delete: 'Delete',
            copyFilename: 'Copy filename',
            colors: {
                yellow: 'Yellow',
                pink: 'Pink',
                blue: 'Blue',
                green: 'Green',
                orange: 'Orange',
                purple: 'Purple',
            },
            sizes: {
                small: 'Small',
                medium: 'Medium',
                large: 'Large',
            },
        },
        tooltip: {
            filename: 'File: {filename}',
        },
        actionBar: {
            complete: 'Completed',
            incomplete: 'Incomplete',
        },
        common: {
            colors: {
                yellow: 'Yellow',
                pink: 'Pink',
                blue: 'Blue',
                green: 'Green',
                orange: 'Orange',
                purple: 'Purple',
            },
            sizes: {
                small: 'Small',
                medium: 'Medium',
                large: 'Large',
            },
        },
        settings: {
            title: 'Postodo Settings',
            language: {
                name: 'Language',
                desc: 'Select display language for settings',
            },
            basic: {
                title: 'Basic Settings',
                notesFolder: {
                    name: 'Storage folder',
                    desc: 'Folder name in vault where notes are stored',
                },
                autoSave: {
                    name: 'Auto save',
                    desc: 'Automatically save changes to files',
                },
                saveInterval: {
                    name: 'Save interval (ms)',
                    desc: 'Delay before auto-saving after editing',
                },
            },
            naming: {
                title: 'File Naming',
                strategy: {
                    name: 'Naming method',
                    desc: 'How new note files are named',
                    options: {
                        timestamp: 'Timestamp (Sticky-yyyyMMddHHmmss)',
                        sequential: 'Sequential (Sticky-0001)',
                        custom: 'Custom',
                    },
                },
            },
            displayFilter: {
                title: 'Display Filter',
                default: {
                    name: 'Initial filter',
                    desc: 'Filter applied when opening the view',
                    options: {
                        incomplete: 'Show incomplete only',
                        complete: 'Show complete only',
                        all: 'Show all',
                    },
                },
            },
            rendering: {
                title: 'Rendering Settings',
                virtualization: {
                    name: 'Virtual scrolling',
                    desc: 'Optimize rendering performance for many notes',
                },
                maxRenderedNotes: {
                    name: 'Max rendered notes',
                    desc: 'Maximum notes to render on screen at once',
                },
            },
            storage: {
                title: 'Sync Settings',
                syncStrategy: {
                    name: 'Sync method',
                    desc: 'When to sync between UI and files',
                    options: {
                        realTime: 'Real-time (sync immediately)',
                        manual: 'Manual (sync on user action)',
                        periodic: 'Periodic (sync at intervals)',
                    },
                },
                conflictResolution: {
                    name: 'Conflict handling',
                    desc: 'How to handle when both UI and file are modified',
                    options: {
                        autoMerge: 'Auto merge (combine both changes)',
                        userChoice: 'Ask user (show selection dialog)',
                        lastWriteWins: 'Last write wins (use latest change)',
                    },
                },
            },
            ui: {
                title: 'Appearance',
                showGrid: {
                    name: 'Show grid lines',
                    desc: 'Display helper grid lines on canvas',
                },
                snapToGrid: {
                    name: 'Snap to grid',
                    desc: 'Align notes to grid when dragging',
                },
            },
            noteDefaults: {
                title: 'Note Defaults',
                color: {
                    name: 'Default color',
                    desc: 'Color applied to new notes',
                },
                size: {
                    name: 'Default size',
                    desc: 'Size applied to new notes',
                },
            },
            advanced: {
                title: 'Advanced Settings',
                debugMode: {
                    name: 'Debug mode',
                    desc: 'Enable developer logging and debug tools',
                },
                maxNotes: {
                    name: 'Note limit',
                    desc: 'Maximum number of notes allowed',
                },
                clearData: {
                    name: 'Delete all data',
                    desc: 'Permanently delete all note data',
                    button: 'Delete All',
                    confirmTitle: 'Delete All Data',
                    confirmMessage: 'All notes will be permanently deleted. This cannot be undone. Are you sure?',
                    cancel: 'Cancel',
                    confirm: 'Delete',
                },
            },
        },
    },
    ja: {
        contextMenu: {
            openNote: 'ノートを開く',
            edit: '編集',
            changeColor: '色を変更',
            changeSize: 'サイズ変更',
            markComplete: '完了にする',
            markIncomplete: '未完了に戻す',
            delete: '削除',
            copyFilename: 'ファイル名をコピー',
            colors: {
                yellow: '黄色',
                pink: 'ピンク',
                blue: '青',
                green: '緑',
                orange: 'オレンジ',
                purple: '紫',
            },
            sizes: {
                small: '小',
                medium: '中',
                large: '大',
            },
        },
        tooltip: {
            filename: 'ファイル: {filename}',
        },
        actionBar: {
            complete: '完了済み',
            incomplete: '未完了',
        },
        common: {
            colors: {
                yellow: '黄色',
                pink: 'ピンク',
                blue: '青',
                green: '緑',
                orange: 'オレンジ',
                purple: '紫',
            },
            sizes: {
                small: '小',
                medium: '中',
                large: '大',
            },
        },
        settings: {
            title: 'Postodo 設定',
            language: {
                name: '言語',
                desc: '設定画面の表示言語を選択します',
            },
            basic: {
                title: '基本設定',
                notesFolder: {
                    name: '保存フォルダ',
                    desc: '付箋データを保存するフォルダ名（Vault内）',
                },
                autoSave: {
                    name: '自動保存',
                    desc: '付箋の変更を自動的にファイルに保存します',
                },
                saveInterval: {
                    name: '保存間隔（ミリ秒）',
                    desc: '自動保存を実行する間隔（編集後の待機時間）',
                },
            },
            naming: {
                title: 'ファイル命名規則',
                strategy: {
                    name: '命名方式',
                    desc: '新規付箋ファイルの命名方法を選択します',
                    options: {
                        timestamp: '日時形式（Sticky-yyyyMMddHHmmss）',
                        sequential: '連番形式（Sticky-0001）',
                        custom: 'カスタム',
                    },
                },
            },
            displayFilter: {
                title: '表示フィルター',
                default: {
                    name: '初期フィルター',
                    desc: 'ビューを開いた時に適用されるフィルター',
                    options: {
                        incomplete: '未完了のみ表示',
                        complete: '完了済みのみ表示',
                        all: 'すべて表示',
                    },
                },
            },
            rendering: {
                title: '描画設定',
                virtualization: {
                    name: '仮想スクロール',
                    desc: '大量の付箋がある場合に描画パフォーマンスを最適化します',
                },
                maxRenderedNotes: {
                    name: '同時描画数',
                    desc: '一度に画面に描画する付箋の最大数',
                },
            },
            storage: {
                title: '同期設定',
                syncStrategy: {
                    name: '同期方式',
                    desc: 'UIとファイル間の同期タイミング',
                    options: {
                        realTime: 'リアルタイム（即時同期）',
                        manual: '手動（ユーザー操作で同期）',
                        periodic: '定期的（一定間隔で同期）',
                    },
                },
                conflictResolution: {
                    name: '競合時の処理',
                    desc: 'UIとファイルの両方が変更された場合の処理方法',
                    options: {
                        autoMerge: '自動マージ（両方の変更を統合）',
                        userChoice: 'ユーザーに確認（選択ダイアログを表示）',
                        lastWriteWins: '後勝ち（最後の変更を採用）',
                    },
                },
            },
            ui: {
                title: '外観設定',
                showGrid: {
                    name: 'グリッド線を表示',
                    desc: 'キャンバス上に補助グリッド線を表示します',
                },
                snapToGrid: {
                    name: 'グリッドに吸着',
                    desc: '付箋をドラッグ時にグリッドに合わせて配置します',
                },
            },
            noteDefaults: {
                title: '付箋のデフォルト',
                color: {
                    name: 'デフォルトの色',
                    desc: '新規付箋に適用される色',
                },
                size: {
                    name: 'デフォルトのサイズ',
                    desc: '新規付箋に適用されるサイズ',
                },
            },
            advanced: {
                title: '詳細設定',
                debugMode: {
                    name: 'デバッグモード',
                    desc: '開発者向けのログ出力とデバッグツールを有効にします',
                },
                maxNotes: {
                    name: '付箋の上限数',
                    desc: '作成できる付箋の最大数',
                },
                clearData: {
                    name: '全データを削除',
                    desc: 'すべての付箋データを完全に削除します',
                    button: '削除を実行',
                    confirmTitle: '全データの削除',
                    confirmMessage: 'すべての付箋が完全に削除されます。この操作は取り消しできません。本当に削除しますか？',
                    cancel: 'キャンセル',
                    confirm: '削除する',
                },
            },
        },
    },
};

/**
 * 翻訳を取得する
 */
export function getTranslations(language: Language): Translations {
    return translations[language] || translations.en;
}
