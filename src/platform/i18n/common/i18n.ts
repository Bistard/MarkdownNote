import { II18nService } from "src/platform/i18n/browser/i18nService";

/**
 * @enum LanguageType
 * Defines the supported languages for the application.
 */
export const enum LanguageType {
    preferOS = 'preferOS', // os-based (Default)
    en = "en",             // English
    zhCN = "zh-cn",        // Chinese (Simplified)
    zhTW = "zh-tw",        // Chinese (Traditional)
}

export function validateLanguageType(raw: string): LanguageType {
    switch (raw) {
        case LanguageType.preferOS:
        case LanguageType.en:
        case LanguageType.zhCN:
        case LanguageType.zhTW:
            return raw;
        default:
            return LanguageType.preferOS;
    }
}

let COMMON_LOCALIZE: Record<CommonLocalize, string>;
export const enum CommonLocalize {
    openDirectory = 'openDirectory',
}

export function getCommonLocalize(i18nService: II18nService, en: CommonLocalize): string {
    if (!COMMON_LOCALIZE) {
        COMMON_LOCALIZE = {
            [CommonLocalize.openDirectory]: i18nService.localize('openDirectory', 'Open a Folder'),
        };
    }
    return COMMON_LOCALIZE[en] ?? i18nService.localize('missingTranslation', 'MISSING_TRANSLATION');
}
