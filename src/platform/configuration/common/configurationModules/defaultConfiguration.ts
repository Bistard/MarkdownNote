import { Disposable } from "src/base/common/dispose";
import { InitProtector, tryOrDefault } from "src/base/common/error";
import { Result, err, ok } from "src/base/common/result";
import { Emitter } from "src/base/common/event";
import { mixin } from "src/base/common/utilities/object";
import { Dictionary } from "src/base/common/utilities/type";
import { IDefaultConfigurationModule, ConfigurationModuleType } from "src/platform/configuration/common/configuration";
import { IConfigurationRegistrant, IRawConfigurationChangeEvent, IRawSetConfigurationChangeEvent, IConfigurationSchema } from "src/platform/configuration/common/configurationRegistrant";
import { IConfigurationStorage, ConfigurationStorage } from "src/platform/configuration/common/configurationStorage";
import { RegistrantType } from "src/platform/registrant/common/registrant";
import { IRegistrantService } from "src/platform/registrant/common/registrantService";

/**
 * @class A {@link DefaultConfiguration} is a class representing the default 
 * configuration of the application. It derives the default configurations from
 * the {@link IConfigurationRegistrant}.
 * 
 * @note Has type {@link ConfigurationModuleType.Default}.
 * @note After the initialization of the module, it will automatically keep 
 * itself updated in response to any changes in the schema registrations of 
 * {@link IConfigurationRegistrant}. 
 */
export class DefaultConfiguration extends Disposable implements IDefaultConfigurationModule {

    // [fields]

    public readonly type = ConfigurationModuleType.Default;

    private readonly _registrant: IConfigurationRegistrant;
    private _storage: IConfigurationStorage;
    private readonly _initProtector: InitProtector;

    // [events]

    private readonly _onDidConfigurationChange = this.__register(new Emitter<IRawConfigurationChangeEvent>());
    public readonly onDidConfigurationChange = this._onDidConfigurationChange.registerListener;

    // [constructor]

    constructor(
        @IRegistrantService registrantService: IRegistrantService,
    ) {
        super();
        this._registrant = registrantService.getRegistrant(RegistrantType.Configuration);
        this._storage = this.__register(new ConfigurationStorage());
        this._initProtector = new InitProtector();
    }

    // [public methods]

    public getConfiguration(): IConfigurationStorage {
        return this._storage;
    }

    public init(): Result<void, Error> {
        const initResult = this._initProtector.init('[DefaultConfiguration] Cannot initialize twice.');
        if (initResult.isErr()) {
            return err(initResult.error);
        }

        this._storage = this.__register(DefaultConfiguration.createDefaultConfigurationStorage(this._registrant));
        this.__register(this._registrant.onDidConfigurationChange(e => this.__onRegistrantConfigurationChange(e)));

        return ok();
    }

    public reload(): Result<void, Error> {
        this.release(this._storage);
        this._storage = this.__register(DefaultConfiguration.createDefaultConfigurationStorage(this._registrant));
        return ok();
    }

    // [private methods]

    private __onRegistrantConfigurationChange(e: IRawSetConfigurationChangeEvent): void {
        const properties = Array.from(e.properties);
        DefaultConfiguration.__updateDefaultConfigurations(this._storage, properties, this._registrant.getConfigurationSchemas());
        this._storage.refreshSections();
        this._onDidConfigurationChange.fire({ properties: properties });
    }

    // [static methods]

    /**
     * @description Create a new {@link IConfigurationStorage} that 
     */
    public static createDefaultConfigurationStorage(registrant: IConfigurationRegistrant): IConfigurationStorage {
        // Default configuration not meant to be changed, we can safely untrack it.
        const storage = new ConfigurationStorage();
        const schemas = registrant.getConfigurationSchemas();
        DefaultConfiguration.__updateDefaultConfigurations(storage, Object.keys(schemas), schemas);
        storage.refreshSections();
        return storage;
    }

    private static __updateDefaultConfigurations(storage: IConfigurationStorage, keysForUpdate: string[], schemas: Dictionary<string, IConfigurationSchema>): void {
        for (const key of keysForUpdate) {
            const schema = schemas[key];

            // make sure the new key has corresponding schema
            if (schema) {
                // Make sure do not override the original value
                const originalValue = tryOrDefault<string | undefined>(undefined, () => storage.get(key));
                const newValue = mixin(originalValue, this.__getDefaultValueFromSchema(schema), { overwrite: true });
                storage.set(key, newValue);
            } else {
                storage.delete(key);
            }
        }
    }

    private static __getDefaultValueFromSchema(schema: IConfigurationSchema): (typeof schema.default | null) {
        if (schema.type === 'null') {
            return null;
        }
        
        if (schema.type !== 'object') {
            return schema.default;
        }

        // schema type is 'object'
        // if the default value of the schema is provided, we simply return it.
        if (schema.default) {
            return schema.default;
        }

        /**
         * If default is not provided, we try to build a corresponding default 
         * value from its schema.
         */
        return this.__extractDefaultValueFromObjectSchema(schema);
    }

    protected static __extractDefaultValueFromObjectSchema(schema: IConfigurationSchema & { type: 'object' }): object | undefined {
        const result: any = {};

        if (!schema || typeof schema !== 'object') {
            return result;
        }

        for (const key in schema.properties) {
            const value = schema.properties[key]!;

            // Handle the nested case
            if (value.type === 'object') {
                result[key] = this.__extractDefaultValueFromObjectSchema(value);
            } 
            // make sure `null` type is sets to `null`
            else {
                result[key] = value.type === 'null' ? null : value.default;
            }
        }

        return result;
    }
}