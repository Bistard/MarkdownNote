import { Disposable } from "src/base/common/dispose";
import { Emitter, Register } from "src/base/common/event";
import { ColorThemeType, PresetColorTheme } from "src/workbench/services/theme/theme";
import { APP_DIR_NAME, IConfigurationService } from "src/platform/configuration/common/configuration";
import { IService, createService } from "src/platform/instantiation/common/decorator";
import { URI } from "src/base/common/files/uri";
import { AsyncResult, Err, Ok } from "src/base/common/result";
import { IBrowserEnvironmentService } from "src/platform/environment/common/environment";
import { IFileService } from "src/platform/files/common/fileService";
import { ILogService } from "src/base/common/logger";
import { InitProtector } from "src/base/common/error";
import { ColorTheme, IColorTheme } from "src/workbench/services/theme/colorTheme";
import { jsonSafeParse } from "src/base/common/json";
import { Dictionary, StringDictionary, isObject, isString } from "src/base/common/utilities/type";
import { IRegistrantService } from "src/platform/registrant/common/registrantService";
import { RegistrantType } from "src/platform/registrant/common/registrant";
import { ColorRegistrant } from "./colorRegistrant";
import { defaultThemeColors } from './themeDefaults';
import { panic } from "src/base/common/utilities/panic";

export const IThemeService = createService<IThemeService>('theme-service');

/**
 * An interface only for {@link ThemeService}.
 */
export interface IThemeService extends IService {

    /**
     * The root path that stores all the theme files (JSON files).
     * @example .wisp/theme/
     */
    readonly themeRootPath: URI;

    /**
     * Fires the latest {@link IColorTheme} whenever the theme is changed.
     */
    readonly onDidChangeTheme: Register<IColorTheme>;

    /**
     * @description Get the current color theme ({@link IColorTheme}).
     */
    getCurrTheme(): IColorTheme;

    /**
     * @description Changes the current theme to the new one.
     * @param id If the id is an URI, the service will try to read the URI
     *           as a JSON file for theme data. If id is an string, it will be
     *           considered as the JSON file name to read at the {@link themeRootPath}.
     * 
     * @note This will fire {@link onDidChangeTheme} once successful.
     * @note When the AsyncResult is resolved as ok, means the new theme is 
     *       loaded successfully and returned. Otherwise an Error must 
     *       encountered.
     */
    switchTo(id: string): Promise<IColorTheme>;

    /**
     * @description Initializes the theme service. Set the current theme to 
     * either:
     *      1. the theme ID that is written in the configuration file, or
     *      2. preset one.
     * @note This will only be invoked when the application get started.
     */
    init(): Promise<void>;
}

/**
 * An interface only for {@link RawThemeJsonReadingData}
 * 
 * @description A valid theme .json file should have four keys: 1. Theme type 
 * 2. Name of the theme 3. theme description 4. colors used in the theme
 */
export interface IRawThemeJsonReadingData {
    readonly type: ColorThemeType;
    readonly name: string;
    readonly description: string;
    readonly colors: Dictionary<string, string>;
}

/**
 * @class
 */
export class ThemeService extends Disposable implements IThemeService {

    declare _serviceMarker: undefined;

    // [events]
    
    private readonly _onDidChangeTheme = this.__register(new Emitter<IColorTheme>());
    public readonly onDidChangeTheme = this._onDidChangeTheme.registerListener;

    // [field]

    public readonly themeRootPath: URI;

    private readonly _registrant: ColorRegistrant;
    private readonly _initProtector: InitProtector;
    
    private readonly _presetThemes: Map<string, IColorTheme>;
    private _currentTheme?: IColorTheme;
    private readonly defaultColors: StringDictionary<string> = defaultThemeColors;

    // [constructor]

    constructor(
        @ILogService private readonly logService: ILogService,
        @IFileService private readonly fileService: IFileService,
        @IRegistrantService private readonly registrantService: IRegistrantService,
        @IConfigurationService private readonly configurationService: IConfigurationService,
        @IBrowserEnvironmentService private readonly environmentService: IBrowserEnvironmentService,
    ) {
        super();
        this._initProtector = new InitProtector();
        this._presetThemes = new Map<string, IColorTheme>();
        this._currentTheme = undefined;
        this._registrant = registrantService.getRegistrant(RegistrantType.Color);

        this.themeRootPath = URI.join(environmentService.appRootPath, APP_DIR_NAME, 'theme');
    }

    // [public methods]

    public getCurrTheme(): IColorTheme {
        if (!this._currentTheme) {
            this._currentTheme = this._presetThemes.values().next().value;
            panic("Theme has not been initialized!");
        }
        return this._currentTheme;
    }

    public switchTo(id: string): Promise<IColorTheme> {
        
        // Read from memory if a preset theme
        const presetTheme = this._presetThemes.get(id);
        if (presetTheme) {
            this._currentTheme = presetTheme;
            this._onDidChangeTheme.fire(presetTheme);
            this.updateDynamicCSSRules();
            return Promise.resolve(presetTheme);
        }

        const themeUri = URI.join(this.themeRootPath, `${id}.json`);
    
        return this.fileService.readFile(themeUri)
            .andThen((themeData) => {
                const themeObj = jsonSafeParse(themeData.toString());
                if (this.__isValidTheme(themeObj)) {
                    const newTheme = new ColorTheme(
                        themeObj.type,
                        themeObj.name,
                        themeObj.description,
                        themeObj.colors
                    );
                    this._currentTheme = newTheme;
                    this._onDidChangeTheme.fire(newTheme);
                    this.updateDynamicCSSRules();
                    return AsyncResult.ok(newTheme);
                }
                return AsyncResult.err(new Error(`Error loading theme from URI: ${themeUri.toString()}`));
            })
            .match(
                (newTheme) => {
                    return newTheme;
                },
                (error) => {
                    this.logService.error("themeService", "Theme is not available.");
                    // Send notification to frontend if needed
                    if (!this._currentTheme) {
                        // If there's no current theme, use a preset theme
                        const presetTheme = this._presetThemes[0];
                        this._currentTheme = presetTheme;
                        this._onDidChangeTheme.fire(presetTheme);
                        this.updateDynamicCSSRules();
                        return presetTheme;
                    }
                    return this._currentTheme;
                }
            );
    }
    
    public async init(): Promise<void> {
        this._initProtector.init('Cannot init twice').unwrap();
    
        // Initialize every preset color themes in the beginning since they are only present in memory.
        // this.initializePresetThemes();
    
        // const themeID = this.configurationService.get<string>(
        //     WorkbenchConfiguration.ColorTheme, // User settings
        //     PresetColorTheme.LightModern,      // Default
        // );
        const themeID = 'lightMorden';
        await this.switchTo(themeID);
    }
    
    // [private methods]
    
    private initializePresetThemes(): IColorTheme[] {
        const themeNames = ['lightModern', 'darkModern'];
        for (const themeName of themeNames) {
            const rawColorMap = this._registrant.getRegisteredColorMap(themeName);  
            if (this.__isValidTheme(rawColorMap)) {
                const theme = new ColorTheme(
                    rawColorMap.type,
                    rawColorMap.name,
                    rawColorMap.description,
                    rawColorMap.colors
                );
                this._presetThemes.set(rawColorMap.name, theme);
            }
        }    
        return [...this._presetThemes.values()];
    }

    private updateDynamicCSSRules(): void {
        const themeData = this.getCurrTheme(); 
        // Merge default colors with theme colors, theme colors take precedence
        const finalColors = {...this.defaultColors, ...themeData.getColor};
        const cssRules = new Set<string>();

        // Generate CSS variables for each color in the theme
        Object.entries(finalColors).forEach(([colorName, colorValue]) => {
            cssRules.add(`:root { ${colorName}: ${colorValue}; }`);
        });
        const cssString = Array.from(cssRules).join('\n');
        this.applyRules(cssString, themeData.name); 
    }

    private applyRules(styleSheetContent: string, rulesClassName: string): void {
        const themeStyles = document.head.getElementsByClassName(rulesClassName);
    
        if (themeStyles.length === 0) {
            // If no existing <style> element for the theme, create a new one
            const elStyle = document.createElement('style');
            elStyle.className = rulesClassName;
            elStyle.textContent = styleSheetContent;
            document.head.appendChild(elStyle);
        } else {
            // If a <style> element already exists, update its content
            (themeStyles[0] as HTMLStyleElement).textContent = styleSheetContent;
        }
    }
      
    private __isValidTheme(rawData: unknown): rawData is IRawThemeJsonReadingData {
        if (typeof rawData !== 'object' || rawData === null) {
            return false;
        }
    
        // Basic validation for the structure of 'rawData'
        const basicValidation = isString(rawData['type']) &&
                                isString(rawData['name']) &&
                                isString(rawData['description']) &&
                                isObject(rawData['colors']);
        if (!basicValidation) {
            return false;
        }

        // Ensure every required color location is present in the theme
        const template = this._registrant.getTemplate();
        const allColorsPresent = [...template].every(location => isString(rawData['colors'][location]));
    
        return allColorsPresent;
    }
}
