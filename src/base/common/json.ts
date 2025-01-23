import { tryOrDefault } from "src/base/common/error";
import { Arrays } from "src/base/common/utilities/array";
import { panic } from "src/base/common/utilities/panic";
import { Dictionary, Mutable, NonUndefined, Pair, isNumber, isObject, isString } from "src/base/common/utilities/type";

/**
 * {@link IJsonSchema} is a type used to represent a schema of JSON data. It 
 * allows for describing the structure of JSON data in a type-safe way. 
 * Depending on the 'type' property, which can be 'string', 'number', 'boolean', 
 * 'null', 'array', or 'object'.
 * 
 * For example, when 'type' is 'number', it can have 'minimum' and 'maximum' 
 * properties.
 * 
 * When 'type' is 'string', it can have 'minLength', 'maxLength', and 'format' 
 * properties. 
 * 
 * Similarly for 'array' and 'object', there are properties to describe the 
 * items in the array and the properties of the object respectively.
 * 
 * When you plan to extend the {@link IJsonSchema} to add additional 
 * requirements, remember to inherit the base class {@link JsonNodeSchemaValidator}
 * as a new validator.
 * 
 * ## The Schema Example
 * ```ts
 * let userSchema: IJsonSchema = {
 *   type: 'object',
 *   properties: {
 *       name: { type: 'string' },
 *       age: { type: 'integer', minimum: 0 },
 *       email: { type: 'string', format: 'email' },
 *       address: {
 *           type: 'object',
 *           properties: {
 *               street: { type: 'string' },
 *               city: { type: 'string' },
 *               country: { type: 'string' }
 *           },
 *           required: ['street', 'city', 'country']
 *       },
 *       hobbies: {
 *           type: 'array',
 *           items: { type: 'string' }
 *       }
 *   },
 *   required: ['name', 'age', 'email', 'address', 'hobbies']
 * };
 * ```
 * ## The valid JSON Data
 * ```ts
 * let userData = {
 *     "name": "John Doe",
 *     "age": 30,
 *     "email": "john@example.com",
 *     "address": {
 *         "street": "123 Main St",
 *         "city": "Springfield",
 *         "country": "USA"
 *     },
 *     "hobbies": ["Reading", "Traveling", "Swimming"]
 * }
 * ```
 * 
 * ## Customized Validator
 * ```ts
 * class UserSchemaValidator extends JsonNodeSchemaValidator {
 *     public override validate(data: any): boolean {
 *         // ...
 *     }
 * }
 * 
 * const validator = new UserSchemaValidator(userSchema);
 * validator.validate(userData); // true
 * validator.validate({}); // false
 * ```
 */
export type IJsonSchema = (
    IJsonSchemaForNull |
    IJsonSchemaForBoolean |
    IJsonSchemaForNumber |
    IJsonSchemaForString |
    IJsonSchemaForArray |
    IJsonSchemaForObject
);

type DataType = 'string' | 'number' | 'boolean' | 'null' | 'array' | 'object';

interface IJsonSchemaBase<TDataType extends DataType>  {
    
    /** The data type of the current schema node. */
    type: TDataType;

    /** The identifier of the schema node. */
    id?: string;

    /** The description of the schema node. */
    description?: string;

    /** The default value of the current schema node. */
    default?: NonUndefined;

    /** If the schema is deprecated. */
    deprecated?: boolean;

    /** An message for shown when the data is deprecated. */
    deprecatedMessage?: string;

    /** An message for shown when the data is not validated. */
    errorMessage?: string;
}

interface IJsonSchemaForNull extends Omit<IJsonSchemaBase<'null'>, 'default'> {
    default?: never;
}

interface IJsonSchemaForBoolean extends IJsonSchemaBase<'boolean'> {
    default?: boolean;
}

interface IJsonSchemaForNumber extends IJsonSchemaBase<'number'> {

    default?: number;

    /** If only supports integer. */
    integer?: true;

    /** The minimum value requirement. */
    minimum?: number;
    
    /** The maximum value requirement. */
    maximum?: number;

    /** Provider a list of ranges to describe the valid number values. */
    ranges?: Pair<number, number>[];
}

interface IJsonSchemaForString extends IJsonSchemaBase<'string'> {

    default?: string;

    /** The minimum length of the string. */
    minLength?: number;

    /** The maximum length of the string. */
    maxLength?: number;

    /** The predefined format of the string. Example: 'email', 'phone number', 'post address' etc. */
    format?: string;

    /** Regular expression to match the valid string. */
    regexp?: string;

    /** When provided, the string can only be one of the enum value. */
    enum?: string[];

    /** When provided, each description serves the corresponding enum. */
    enumDescription?: string[];
}

interface IJsonSchemaForArray extends IJsonSchemaBase<'array'> {

    default?: any[];

    /** The items of the array. */
    items?: IJsonSchema | IJsonSchema[];

    /** The minimum number of items required. */
    minItems?: number;

    /** The maximum number of items required. */
	maxItems?: number;

    /** If the items in the array should be unique. */
	uniqueItems?: boolean;
}

interface IJsonSchemaForObject extends IJsonSchemaBase<'object'> {
    
    default?: object;

    /** The properties of the schema node. */
    properties?: Dictionary<string, IJsonSchema>;

    /** The minimum number of properties required. */
    minProperties?: number;

    /** The maximum number of properties required. */
    maxProperties?: number;

    /** The required properties which must be provided. */
    required?: string[];
}

export type IJsonSchemaValidateResult = { readonly valid: true } | {
    readonly valid: false;
    readonly errorMessage: string;
    
    /**
     * Will be given if error is caused by un-matching schema.
     */
    readonly schema?: IJsonSchema;
    
    /**
     * Will be given when the schema is deprecated.
     */
    readonly deprecatedMessage?: string;
};

export class JsonSchemaValidator {

    private constructor() {}

    /**
     * @description Validates the provided data against the schema. Currently, 
     * it only checks if the schema is deprecated, in which case it returns 
     * `true`.
     * @param data The data to be validated.
     * @param schema The schema for validation.
     */
    public static validate(data: any, schema: IJsonSchema): IJsonSchemaValidateResult {
        const result: Mutable<IJsonSchemaValidateResult> = { valid: true };
        this.__validate(data, schema, result);
        return result;
    }

    private static __validate(data: any, schema: IJsonSchema, result: Mutable<IJsonSchemaValidateResult>): void {
        if (schema.deprecated === true) {
            this.__setValid(false, result, schema);
            return;
        }

        if (typeof data === 'undefined') {
            return this.__setValid(false, result, schema);
        }
    
        switch (schema.type) {
            case 'null': {
                return this.__setValid(data === null, result, schema);
            }
            
            case 'boolean': {
                return this.__setValid(typeof data === 'boolean', result, schema);
            }
            
            case 'number': {
                if (!isNumber(data)) {
                    return this.__setValid(false, result, schema);
                }

                const isInteger = schema.integer ? Number.isInteger(data) : true;
                const inRange = (schema.minimum ? data >= schema.minimum : true) && 
                                (schema.maximum ? data <= schema.maximum : true);

                return this.__setValid(isInteger && inRange, result, schema);
            }
            
            case 'string': {
                if (!isString(data)) {
                    return this.__setValid(false, result, schema);
                }

                const withinLength = (schema.minLength ? data.length >= schema.minLength : true) && 
                                     (schema.maxLength ? data.length <= schema.maxLength : true);
                const matchesFormat = schema.format ? new RegExp(schema.format).test(data) : true;
                const matchRegExp = tryOrDefault(
                    !schema.regexp,
                    () => {
                        const regexp = new RegExp(schema.regexp!);
                        return regexp.test(data);
                    },
                );

                if (schema.enum) {
                    // make sure default is one of the enum
                    if (!schema.enum.includes(data)) {
                        return this.__setValid(false, result, schema);
                    }
                }

                if (schema.format) {
                    panic('Does not support yet.');
                }

                return this.__setValid(withinLength && matchesFormat && matchRegExp, result, schema);
            }
            
            case 'array': {
                if (!Array.isArray(data)) {
                    return this.__setValid(false, result, schema);
                }

                const withinItemCount = (schema.minItems ? data.length >= schema.minItems : true) && 
                                        (schema.maxItems ? data.length <= schema.maxItems : true);
                const itemsUnique = schema.uniqueItems ? (new Set(data)).size === data.length : true;
                const itemsValid = schema.items ? data.every((item, idx) => this.validate(item, Array.isArray(schema.items) ? schema.items[idx]! : schema.items!)) : true;

                return this.__setValid(withinItemCount && itemsUnique && itemsValid, result, schema);
            }
            
            case 'object': {
                if (!isObject(data)) {
                    return this.__setValid(false, result, schema);
                }

                const propertyKeys = Object.keys(data);
                const schemaKeys = schema.properties ? Object.keys(schema.properties) : [];

                // Checking the minimum and maximum properties
                if ((schema.minProperties && propertyKeys.length < schema.minProperties) || 
                    (schema.maxProperties && propertyKeys.length > schema.maxProperties)) 
                {
                    return this.__setValid(false, result, schema);
                }

                // Ensuring no additional properties are present if 'additionalProperties' is not set
                const missingKeys = Arrays.relativeComplement(propertyKeys, schema.required ?? []);
                if (missingKeys.length > 0) {
                    return this.__setValid(false, result, schema);
                }

                // Ensuring all required properties are present
                if (schema.required && !schema.required.every(key => propertyKeys.includes(key))) {
                    return this.__setValid(false, result, schema);
                }

                // Checking each property against its schema
                if (schema.properties && !schemaKeys.every(key => this.validate(data[key], schema.properties![key]!))) {
                    return this.__setValid(false, result, schema);
                }

                return;
            }
        }
    }

    private static __setValid(valid: boolean, result: Mutable<IJsonSchemaValidateResult>, schema: IJsonSchema): void {
        result.valid = valid;
        if (!result.valid) {
            result.schema = schema;
            result.errorMessage = schema.errorMessage ?? 'No Error Messages';
            if (schema.deprecated) {
                result.deprecatedMessage = schema.deprecatedMessage ?? 'No Deprecated Messages';
            }
        }
    }
}