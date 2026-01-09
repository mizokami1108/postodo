import { INamingStrategy, NamingStrategyType } from '../../interfaces/naming/i-naming-strategy';
import { TimestampNamingStrategy } from './timestamp-naming-strategy';
import { SequentialNamingStrategy, IFileScanner } from './sequential-naming-strategy';

/**
 * 命名戦略のファクトリークラス
 * 設定に基づいて適切な命名戦略を生成する
 */
export class NamingStrategyFactory {
    private fileScanner?: IFileScanner;

    /**
     * @param fileScanner 連番戦略で使用するファイルスキャナー
     */
    constructor(fileScanner?: IFileScanner) {
        this.fileScanner = fileScanner;
    }

    /**
     * ファイルスキャナーを設定する
     */
    setFileScanner(fileScanner: IFileScanner): void {
        this.fileScanner = fileScanner;
    }

    /**
     * 指定された種類の命名戦略を生成する
     * @param strategyType 命名戦略の種類
     * @returns 命名戦略のインスタンス
     */
    create(strategyType: NamingStrategyType): INamingStrategy {
        switch (strategyType) {
            case 'timestamp':
                return new TimestampNamingStrategy();
            case 'sequential':
                return new SequentialNamingStrategy(this.fileScanner);
            case 'custom':
                // カスタム戦略はデフォルトでタイムスタンプを使用
                return new TimestampNamingStrategy();
            default:
                return new TimestampNamingStrategy();
        }
    }
}
