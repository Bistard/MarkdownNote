import { Emitter, Register } from "src/base/common/event";
import { URI } from "src/base/common/files/uri";
import { IService, createService } from "src/platform/instantiation/common/decorator";
import { ILogService } from "src/base/common/logger";
import { AsyncResult } from "src/base/common/result";
import { FileOperationError } from "src/base/common/files/file";
import { LanguageType, validateLanguageType } from "src/platform/i18n/common/i18n";
import { IFileService } from "src/platform/files/common/fileService";
import { ConfigurationModuleType, IConfigurationService } from "src/platform/configuration/common/configuration";
import { IConfigurationChangeEvent } from "src/platform/configuration/common/abstractConfigurationService";
import { Strings } from "src/base/common/utilities/string";
import { WorkbenchConfiguration } from "src/workbench/services/workbench/configuration.register";
import { Disposable } from "src/base/common/dispose";
import { IHostService } from "src/platform/host/common/hostService";
import { INlsConfiguration } from "src/platform/window/common/window";
import { IProductService } from "src/platform/product/common/productService";

export const II18nService = createService<II18nService>("i18n-service");

/**
 * This data structure is constructed during compiled time.
 */
export type II18nLookUpTable = string[];

/**
 * An interface only for {@link I18nService}.
 */
export interface II18nService extends IService {
    /**
     * Current language.
     */
    readonly language: LanguageType;

    /**
     * Fires when the language changes.
     */
    readonly onDidChange: Register<void>;

    /**
     * @description Initializes the service, loading the default language's 
     * locale file.
     */
    init(): AsyncResult<void, FileOperationError | SyntaxError>;

    /**
     * @description Sets the display language. This will try to reload the 
     * window.
     */
    setLanguage(lang: LanguageType): Promise<void>;

    /**
     * @description Localize a key with optional interpolation.
     */
    localize(key: string /** | number (in runtime) */, defaultMessage: string, interpolation?: Record<string, any>): string;
}

/**
 * @class The i18n (internationalization) service for loading and translating 
 * locales.
 */
export class I18nService extends Disposable implements II18nService {
    
    // [fields]

    declare _serviceMarker: undefined;

    protected readonly _language: LanguageType;
    protected readonly _localeRootPath: URI; // the root that contains all the locales
    protected _table?: II18nLookUpTable;

    // [event]

    private readonly _onDidChange = this.__register(new Emitter<void>());
    public readonly onDidChange = this._onDidChange.registerListener;

    // [constructor]

    constructor(
        nlsConfiguration: INlsConfiguration,
        localeRootPath: URI,
        @ILogService private readonly logService: ILogService,
        @IFileService private readonly fileService: IFileService,
        @IConfigurationService private readonly configurationService: IConfigurationService,
        @IHostService private readonly hostService: IHostService,
        @IProductService private readonly productService: IProductService,
    ) {
        super();
        this._localeRootPath = localeRootPath;
        this._language = validateLanguageType(nlsConfiguration.resolvedLanguage);
    }

    // [public methods]

    public get language(): LanguageType {
        return this._language;
    }

    public init(): AsyncResult<void, FileOperationError | SyntaxError> {
        this.logService.debug("I18nService", "Initializing...");
        const uri = URI.join(this._localeRootPath, `${this._language}_lookup_table.json`);
        
        // load the look up table from the disk
        this.logService.debug('i18nService', `Loading lookup table at: ${URI.toString(uri)}`);
        return this.fileService.readFile(uri)
            // parse as array
            .andThen(buffer => Strings.jsonParseSafe<II18nLookUpTable>(buffer.toString()))
            // store in memory and start register listeners.
            .map(table => { 
                this._table = table;
                this.__register(this.configurationService.onDidConfigurationChange(this.__onConfigurationChange.bind(this)));
                this.logService.debug("I18nService", "Initialized successfully.");
            });
    }

    public async setLanguage(lang: LanguageType): Promise<void> {
        if (lang === this._language) {
            return;
        }

        const dialogResult = await this.hostService.showMessageBox({
            message: this.localize('relaunchDisplayLanguageMessage', 'Restart {name} to switch to language: {languageName}?', { 
                    name: this.productService.profile.applicationName, 
                    languageName: lang,
                }
            ),
            type: 'info',
            noLink: true,
            buttons: ['Restart', 'Cancel'],
        });

        // clicked cancel
        if (dialogResult.response !== 0) {
            return;
        }

        // TODO: chris: i think a RestoreService is required in renderer process
        await this.configurationService.set(WorkbenchConfiguration.DisplayLanguage, lang, { type: ConfigurationModuleType.User });
        this.hostService.reloadWindow({ nlsConfiguration: { resolvedLanguage: lang } });
    }

    public localize(key: string /** | number (in runtime) */, defaultMessage: string, interpolation?: Record<string, any>): string {
        if (!this._table) {
            this.logService.warn("I18nService", "Localization table is not loaded, returning default message.");
            return defaultMessage;
        }
        const value = this._table[key as unknown as number] || defaultMessage;
        return this.__insertToLocalize(value, interpolation);
    }

    // [private methods]

    private __onConfigurationChange(event: IConfigurationChangeEvent): void {
        const language = WorkbenchConfiguration.DisplayLanguage;
        if (event.affect(language)) {
            const newLanguage = this.configurationService.get<LanguageType>(language, LanguageType.preferOS);
            this.setLanguage(newLanguage);
        }
    }

    private __insertToLocalize(value: string, interpolation?: Record<string, any>): string {
        if (!interpolation) {
            return value;
        }
        return value.replace(/\{(\w+)\}/g, (_, key) => {
            if (interpolation[key] !== undefined) {
                return String(interpolation[key]);
            }
            this.logService.warn("I18nService", `Missing interpolation value for key: ${key}`);
            return `{${key}}`;
        });
    }
}
