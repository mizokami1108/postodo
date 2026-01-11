import { INamingStrategy, NamingStrategyType } from '../../interfaces/naming/i-naming-strategy';
import { TimestampNamingStrategy } from './timestamp-naming-strategy';
import { CustomNamingStrategy } from './custom-naming-strategy';

/**
 * 命名方式のファクトリークラス
 * 設定に基づいて適切な命名方式を生成する
 */
export class NamingStrategyFactory {
    private customFormat?: string;

    /**
     * @param customFormat カスタム命名フォーマット
     */
    constructor(customFormat?: string) {
        this.customFormat = customFormat;
    }

    /**
     * カスタムフォーマットを設定する
     */
    setCustomFormat(format: string): void {
        this.customFormat = format;
    }

    /**
     * 指定された種類の命名方式を生成する
     * @param strategyType 命名方式の種類
     * @returns 命名方式のインスタンス
     */
    create(strategyType: NamingStrategyType): INamingStrategy {
        console.log(`[DEBUG] NamingStrategyFactory.create: Creating strategy '${strategyType}', customFormat = '${this.customFormat}'`);
        switch (strategyType) {
            case 'timestamp':
                return new TimestampNamingStrategy();
            case 'custom':
                return new CustomNamingStrategy(this.customFormat);
            default:
                return new TimestampNamingStrategy();
        }
    }
}
