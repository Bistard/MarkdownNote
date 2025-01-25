import { Disposable } from "src/base/common/dispose";
import { Emitter, Register } from "src/base/common/event";
import { ColorThemeType, PresetColorTheme } from "src/workbench/services/theme/theme";
import { APP_DIR_NAME, IConfigurationService } from "src/platform/configuration/common/configuration";
import { IService, createService } from "src/platform/instantiation/common/decorator";
import { URI } from "src/base/common/files/uri";
import { err, ok } from "src/base/common/result";
import { IBrowserEnvironmentService } from "src/platform/environment/common/environment";
import { IFileService } from "src/platform/files/common/fileService";
import { ILogService } from "src/base/common/logger";
import { InitProtector } from "src/base/common/error";
import { ColorTheme, IColorTheme, PRESET_COLOR_THEME_METADATA, isPresetColorTheme, toCssVariableName } from "src/workbench/services/theme/colorTheme";
import { Dictionary, isObject, isString } from "src/base/common/utilities/type";
import { IRegistrantService } from "src/platform/registrant/common/registrantService";
import { RegistrantType } from "src/platform/registrant/common/registrant";
import { assert, panic } from "src/base/common/utilities/panic";
import { WorkbenchConfiguration } from "src/workbench/services/workbench/configuration.register";
import { mixin } from "src/base/common/utilities/object";
import { Color, ColorMap } from "src/base/common/color";
import { noop } from "src/base/common/performance";
import { NotificationTypes } from "src/workbench/services/notification/notificationService";
import { ColorRegistrant } from "src/workbench/services/theme/colorRegistrant";
import { Strings } from "src/base/common/utilities/string";
import { INotificationService } from "src/workbench/services/notification/notification";

export const IThemeService = createService<IThemeService>('theme-service');

/**
 * An interface only for {@link ThemeService}.
 */
export interface IThemeService extends Disposable, IService {

    /**
     * The root path that stores all the theme files (JSON files).
     * @example .appConfigDir/theme/
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
     * @description Changes the current theme to the specified theme.
     * @param id The identifier for the new theme. If the identifier is not one
     *           of the preset theme, it is considered the filename within 
     *           {@link themeRootPath}.
     * @returns A promise that resolves to the new {@link IColorTheme} upon 
     *          successful theme switch. If fails, returns the current one.
     * @note Triggers {@link onDidChangeTheme} upon success.
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
 * @description A valid theme .json file should have four keys: 
 *  1. Theme type 
 *  2. Theme name
 *  3. Theme description 
 *  4. Colors mapping
 */
export interface IRawThemeJsonReadingData {
    readonly type: ColorThemeType;
    readonly name: string;
    readonly description: string;
    readonly colors: Dictionary<string, string | Color>;
}

/**
 * @class Manages the application's visual theme, including loading, applying, 
 * and switching themes.
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

    // [constructor]

    constructor(
        @ILogService private readonly logService: ILogService,
        @IFileService private readonly fileService: IFileService,
        @IRegistrantService registrantService: IRegistrantService,
        @IConfigurationService private readonly configurationService: IConfigurationService,
        @IBrowserEnvironmentService environmentService: IBrowserEnvironmentService,
        @INotificationService private readonly notificationService: INotificationService,
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
            panic("[ThemeService] ThemeService has not been initialized!");
        }
        return this._currentTheme;
    }

    public async switchTo(id: string): Promise<IColorTheme> {
        
        // Read from the memory if it is identified as a preset theme.
        const presetTheme = this._presetThemes.get(id);
        if (presetTheme) {
            this.__applyColorTheme(presetTheme);
            return presetTheme;
        }

        // The ID is not identified, try to read it from the disk.
        const themePath = URI.join(this.themeRootPath, `${id}.json`);
        
        // read from the disk and try to parse it
        return this.fileService.readFile(themePath)
            .andThen(themeData => Strings.jsonParseSafe(themeData.toString())
            
            // validate the raw data and apply the theme
            .andThen<IColorTheme, Error>(rawData => {
                const validation = this.__isValidTheme(rawData, false);
                if (!validation.valid) {
                    return err(new Error(`Cannot validate the theme at: '${URI.toString(themePath)}'. The reason is: ${validation.reason}`));
                }
                
                const newTheme = new ColorTheme(validation.rawData);
                this.__applyColorTheme(newTheme);

                return ok(newTheme);
            }))
            .match(
                newTheme => newTheme,
                error => {
                    this.logService.error('themeService', `Cannot switch to the theme '${id}'. The reason is:`, error);
                    this.notificationService.notify({
                        type: NotificationTypes.Info,
                        message: `Failed to switch to theme '${id}'. Please check the theme settings and try again.`,
                        actions: [{
                            label: 'Dismiss',
                            run: noop,
                        }]
                    });

                    // If there's no current theme, use a preset theme.
                    if (!this._currentTheme) {
                        const presetTheme = this.__applyColorTheme(undefined);
                        return presetTheme;
                    }

                    return this._currentTheme;
                }
            );
    }
    
    public async init(): Promise<void> {
        this._initProtector.init('Cannot init twice').unwrap();
        this.__assertPresetThemes();
    
        const themeID = this.configurationService.get<string>(WorkbenchConfiguration.ColorTheme, PresetColorTheme.LightModern);
        await this.switchTo(themeID);
    }
    
    // [private methods]
    
    /**
     * @description Assert and make sure all the preset themes are all valid 
     * {@link ColorTheme}s.
     */
    private __assertPresetThemes(): void {
        for (const themeMetadata of PRESET_COLOR_THEME_METADATA) {
            const rawColorMap = this._registrant.getRegisteredColorMap(themeMetadata.name);  

            const validation = this.__isValidTheme({ ...themeMetadata, colors: rawColorMap }, true);
            if (!validation.valid) {
                panic(new Error(`[ThemeService] Preset color theme is not a valid theme: ${themeMetadata.name}. The reason is: ${validation.reason}`));
            }

            const validRaw = validation.rawData;
            this._presetThemes.set(validRaw.name, new ColorTheme(validRaw));
        }
    }

    private __isValidTheme(rawData: unknown, isPreset: boolean): ColorThemeValidateResult {
        if (!isObject(rawData)) {
            return { valid: false, reason: 'The theme raw data is not an object type.' };
        }
    
        // Basic validation for the structure of 'rawData'
        const basicValidation = isString(rawData['type']) &&
                                isString(rawData['name']) &&
                                isString(rawData['description']) &&
                                isObject(rawData['colors']);
        if (!basicValidation) {
            return { valid: false, reason: 'The theme is missing the basic metadata: "type", "name", "description" or "colors".' };
        }

        if (!isPreset && isPresetColorTheme(rawData['name'])) {
            return { valid: false, reason: `The theme shares its name with a preset theme: ${rawData['name']}.` };
        }

        /**
         * Ensure every required color location is present in the theme when it 
         * is a preset theme. The user theme is allow to have partial colors
         * since the missing one will be filled with the preset one.
         */
        if (isPreset) {
            const template = this._registrant.getTemplate();
            for (const location of template) {
                const isPresent = Color.is(rawData['colors'][location]);
                if (!isPresent) {
                    return { valid: false, reason: `The theme is missing the color: '${location}'` };
                }
            }
        }
        
        return { valid: true, rawData: <any>rawData };
    }

    /**
     * @description When `undefined` if provided, applying {@link PresetColorTheme.LightModern}
     * as default.
     */
    private __applyColorTheme(newTheme?: IColorTheme): IColorTheme {
        newTheme ??= assert(this._presetThemes.get(PresetColorTheme.LightModern));
        
        this.__updateDynamicCSSRules(newTheme);
        this._currentTheme = newTheme;

        this._onDidChangeTheme.fire(newTheme);
        return newTheme;
    }

    private __updateDynamicCSSRules(theme: IColorTheme): void {
        const resolvedColorMap = this.__mergeWithPresetColorMap(theme);
        
        // Generate CSS variables for each color in the theme
        const cssRules = new Set<string>();
        Object.entries(resolvedColorMap).forEach(([colorName, colorValue]) => {
            cssRules.add(`${toCssVariableName(colorName)}: ${colorValue};`);
        });
        
        const cssVariables = [...cssRules].join('\n');
        const cssStylesInString = `:root { ${cssVariables} }`;

        this.__applyRulesToDocument(cssStylesInString, theme.name); 
    }

    /**
     * Consider the user provided {@link IColorTheme} might miss colors, to
     * make sure all the colors are present, we mixin the {@link ColorMap}
     * to the corresponding preset one.
     */
    private __mergeWithPresetColorMap(theme: IColorTheme): ColorMap {
        if (isPresetColorTheme(theme.name)) {
            return theme.getColorMap();
        } 
        
        const baseColorMap = theme.type === ColorThemeType.Light
            ? assert(this._presetThemes.get(PresetColorTheme.LightModern))
            : assert(this._presetThemes.get(PresetColorTheme.DarkModern));
        
        return mixin(baseColorMap, theme.getColorMap(), true);
    }

    private __applyRulesToDocument(styleSheetContent: string, themeName: string): void {
        const themeStyles = document.head.getElementsByClassName(themeName);
    
        if (themeStyles.length === 0) {
            // If no existing <style> element for the theme, create a new one
            const style = document.createElement('style');
            style.type = 'text/css';
            style.media = 'screen';
            style.className = themeName;
            style.textContent = styleSheetContent;
            document.head.appendChild(style);
        } else {
            // If a <style> element already exists, update its content
            assert(themeStyles[0]).textContent = styleSheetContent;
        }
    }
}

type ColorThemeValidateResult = IOkColorThemeResult | IErrColorThemeResult;

interface IOkColorThemeResult {
    readonly valid: true;
    readonly rawData: IRawThemeJsonReadingData;
}

interface IErrColorThemeResult {
    readonly valid: false;
    readonly reason: string;
}