import { memoize } from "src/base/common/memoization";
import { CharCode } from "src/base/common/utilities/char";
import { Numbers } from "src/base/common/utilities/number";
import { panic } from "src/base/common/utilities/panic";
import { Random } from "src/base/common/utilities/random";
import { Dictionary, DightInString } from "src/base/common/utilities/type";

/**
 * # outline
 * {@link IColor} {@link Color}
 * {@link RGBA}
 * {@link HSLA}
 */

/**
 * ANSI escape color codes for foreground color.
 */
export const enum ASNIForegroundColor {
    Reset = '\x1b[39m',
	Black = '\x1b[30m',
    Red = '\x1b[31m',
    Green = '\x1b[32m',
    Yellow = '\x1b[33m',
    Blue = '\x1b[34m',
    Magenta = '\x1b[35m',
    Cyan = '\x1b[36m',
    White = '\x1b[37m',
	LightGray = '\x1b[90m',
    LightRed = '\x1b[91m',
    LightGreen = '\x1b[92m',
    LightYellow = '\x1b[93m',
    LightBlue = '\x1b[94m',
    LightMagenta = '\x1b[95m',
    LightCyan = '\x1b[96m',
    LightWhite = '\x1b[97m',
}

/**
 * ANSI escape color codes for background color.
 */
export const enum ASNIBackgroundColor {
    Reset = '\x1b[49m',
	Black = '\x1b[40m',
    Red = '\x1b[41m',
    Green = '\x1b[42m',
    Yellow = '\x1b[43m',
    Blue = '\x1b[44m',
    Magenta = '\x1b[45m',
    Cyan = '\x1b[46m',
    White = '\x1b[47m',
    LightGray = '\x1b[100m',
    LightRed = '\x1b[101m',
    LightGreen = '\x1b[102m',
    LightYellow = '\x1b[103m',
    LightBlue = '\x1b[104m',
    LightMagenta = '\x1b[105m',
    LightCyan = '\x1b[106m',
    LightWhite = '\x1b[107m',
}

export type ANSIColor = ASNIForegroundColor | ASNIBackgroundColor;

export namespace TextColors {
	/**
	 * @description Sets the ANSI foreground and background colors for a given 
	 * string of text.
	 * 
	 * @param text - The text to be colored.
	 * @param fgColor - The ANSI foreground color code to set for the text.
	 * @param bgColor - The ANSI background color code to set for the text.
	 * @returns - The text string prefixed with ANSI color codes and suffixed 
	 * with a reset color code.
	 *
	 * @example
	 * const coloredText = setANSIColor("This is a colored message.", ASNIForegroundColor.Red, ASNIBackgroundColor.White);
	 * console.log(coloredText); // Prints the message in red color with white background in the console.
	 */
	export function setANSIColor(text: string, colors?: { fgColor?: ASNIForegroundColor, bgColor?: ASNIBackgroundColor }): string {
		return `${colors?.fgColor ?? ''}${colors?.bgColor ?? ''}${text}\x1b[0m`;
	}

	/**
	 * @description Sets the ANSI (RGB) foreground for a given string of text. 
	 * The color is only supported with modern command line.
	 * @param text The text to be colored.
	 * @returns The text string prefixed with ANSI color codes and suffixed with 
	 * a reset color code.
	 */
	export function setRGBColor(text: string, r: number, g: number, b: number): string {
		return `\x1b[38;2;${r};${g};${b}m${text}\x1b[0m`;
	}
}

export type LowerHexLetter = 'a' | 'b' | 'c' | 'd' | 'e' | 'f';
export type UpperHexLetter = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
export type HexDigit = LowerHexLetter | UpperHexLetter | DightInString;

/**
 * @type If the given string is in the form '#xxxxxx' where x stands for legal 
 * {@link HexDigit}.
 */
export type HexColor<T extends string> =
    T extends `#${HexDigit}${HexDigit}${HexDigit}${infer Rest1}`
        ? (Rest1 extends `` 
            ? T // three-digit hex color
            : (
                Rest1 extends `${HexDigit}${HexDigit}${HexDigit}`
                    ? T  // six-digit hex color
                    : never
            )
        )
        : never;

export type ColorMap = Dictionary<string, Color>;

/**
 * An interface only for {@link Color}.
 */
export interface IColor {
	/**
	 * The RGBA representation of the color.
	 */
	readonly RGBA: RGBA;
  
	/**
	 * The HSLA representation of the color.
	 */
	readonly HSLA: HSLA;
  
	/**
	 * @description Returns the string format of the color. The format will use 
	 * the hexadecimal format if opaque and RGBA format otherwise.
	 */
	toString(): string;

	/**
	 * @description Checks if the current color is equal to another color.
	 * @param other - The color to compare with.
	 * @returns True if the colors are equal, otherwise false.
	 */
	equals(other?: IColor): boolean;
  
	/**
	 * @description Determines if the color is darker based on luminance.
	 * @returns True if the color is darker, otherwise false.
	 */
	isDarker(): boolean;
  
	/**
	 * @description Determines if the color is lighter based on luminance.
	 * @returns True if the color is lighter, otherwise false.
	 */
	isLighter(): boolean;
  
	/**
	 * @description Lightens the color by a given factor.
	 * @param factor - The factor by which to lighten the color.
	 * @returns A new color instance that is lightened.
	 */
	lighten(factor: number): IColor;
  
	/**
	 * @description Darkens the color by a given factor.
	 * @param factor - The factor by which to darken the color.
	 * @returns A new color instance that is darkened.
	 */
	darken(factor: number): IColor;
  
	/**
	 * @description Adjusts the transparency of the color by a given factor.
	 * @param factor - The factor by which to adjust the transparency.
	 * @returns A new color instance with adjusted transparency.
	 */
	transparent(factor: number): IColor;
  
	/**
	 * @description Checks if the color is fully transparent.
	 * @returns True if the color is fully transparent, otherwise false.
	 */
	isTransparent(): boolean;
  
	/**
	 * @description Checks if the color is fully opaque.
	 * @returns True if the color is fully opaque, otherwise false.
	 */
	isOpaque(): boolean;
  
	/**
	 * @description Returns the opposite (inverted) color.
	 * @returns A new color instance that is the opposite of the current color.
	 */
	opposite(): IColor;
}

/**
 * @description The {@link Color} class represents a color in both {@link RGBA} 
 * and {@link HSLA} color spaces.
 */
export class Color implements IColor {

	// [fields]

	private _rgba: RGBA;
	private _hsla?: HSLA;
	
	// [getter]

	get RGBA(): RGBA {
		return this._rgba;
	}

	get HSLA(): HSLA {
		if (this._hsla) {
			return this._hsla;
		}
		this._hsla = HSLA.fromRGBA(this._rgba);
		return this._hsla;
	}

	// [constructor]

	constructor(value: RGBA | HSLA) {
		if (value instanceof RGBA) {
			this._rgba = value;
		} else if (value instanceof HSLA) {
			this._hsla = value;
			this._rgba = HSLA.toRGBA(this._hsla);
		} else {
			panic(`color argument is invalid: ${value}`);
		}
	}

	// [public methods]

	/**
	 * @description Build a {@link Color} from the hexadecimal string. If the 
	 * string is invalid, {@link RGBA.RED} is returned.
	 */
	public static parseHex(str: string): Color {
		return new Color(RGBA.parse(str) ?? RGBA.RED);
	}

	public static is(obj: any): obj is Color {
		return obj instanceof Color;
	}

	/**
	 * @description Generate a random color.
	 */
	public static random(): Color {
		return new Color(new RGBA(Random.int(256), Random.int(256), Random.int(256)));
	}

	@memoize
	public toString(): string {
		if (this.isOpaque()) {
			return this.RGBA.toStringHex();
		}
		return this.RGBA.toStringHexA();
	}

	public equals(other?: Color): boolean {
		return !!other && RGBA.equals(this.RGBA, other.RGBA) && HSLA.equals(this.HSLA, other.HSLA);
	}

	/**
	 *	http://24ways.org/2010/calculating-color-contrast
	 *  Return 'true' if darker color otherwise 'false'
	 */
	public isDarker(): boolean {
		const yiq = (this.RGBA.r * 299 + this.RGBA.g * 587 + this.RGBA.b * 114) / 1000;
		return yiq < 128;
	}

	/**
	 *	http://24ways.org/2010/calculating-color-contrast
	 *  Return 'true' if lighter color otherwise 'false'
	 */
	public isLighter(): boolean {
		const yiq = (this.RGBA.r * 299 + this.RGBA.g * 587 + this.RGBA.b * 114) / 1000;
		return yiq >= 128;
	}

	public lighten(factor: number): Color {
		return new Color(new HSLA(this.HSLA.h, this.HSLA.s, this.HSLA.l + this.HSLA.l * factor, this.HSLA.a));
	}

	public darken(factor: number): Color {
		return new Color(new HSLA(this.HSLA.h, this.HSLA.s, this.HSLA.l - this.HSLA.l * factor, this.HSLA.a));
	}

	public transparent(factor: number): Color {
		const { r, g, b, a } = this.RGBA;
		return new Color(new RGBA(r, g, b, a * factor));
	}

	public isTransparent(): boolean {
		return this.RGBA.a === 0;
	}

	public isOpaque(): boolean {
		return this.RGBA.a === 1;
	}

	public opposite(): Color {
		return new Color(new RGBA(255 - this.RGBA.r, 255 - this.RGBA.g, 255 - this.RGBA.b, this.RGBA.a));
	}
}

export class RGBA {

	// [field]

	/** Red: integer in [0-255] */
	public readonly r: number;

	/** Green: integer in [0-255] */
	public readonly g: number;

	/** Blue: integer in [0-255] */
	public readonly b: number;

	/** Alpha: float in [0-1] */
	public readonly a: number;

	public static readonly WHITE  = new RGBA(255, 255, 255, 1);
	public static readonly BLACK  = new RGBA(0, 0, 0, 1);
	public static readonly RED 	  = new RGBA(255, 0, 0, 1);
	public static readonly BLUE   = new RGBA(0, 0, 255, 1);
	public static readonly GREEN  = new RGBA(0, 255, 0, 1);
	public static readonly YELLOW = new RGBA(255, 255, 0, 1);

	// [constructor]

	constructor(r: number, g: number, b: number, a: number = 1) {
		this.r = Numbers.clamp(r, 0, 255) | 0;
		this.g = Numbers.clamp(g, 0, 255) | 0;
		this.b = Numbers.clamp(b, 0, 255) | 0;
		this.a = __roundFloat(Math.max(Math.min(1, a), 0), 3);
	}

	// [public methods]

	@memoize
	public toString(): string {
		return `rgb(${this.r},${this.g},${this.b},${this.a})`;
	}

	/**
	 * @description Formats the color as #RRGGBB (no alpha)
	 */
	@memoize
	public toStringHex(): string {
		return `#${__toTwoDigitHex(this.r)}${__toTwoDigitHex(this.g)}${__toTwoDigitHex(this.b)}`;
	}

	/**
	 * @description Formats the color as #RRGGBBAA (with alpha)
	 * If 'compact' is set, colors without transparency will be printed as #RRGGBB
	 */
	@memoize
	public toStringHexA(compact = false): string {
		if (compact && this.a === 1) {
			return this.toStringHex();
		}
		return `#${__toTwoDigitHex(this.r)}${__toTwoDigitHex(this.g)}${__toTwoDigitHex(this.b)}${__toTwoDigitHex(Math.round(this.a * 255))}`;
	}

	public static toString(color: RGBA): string {
        return color.toString();
    }

	public static is(obj: any): obj is RGBA {
		if (obj instanceof RGBA) {
			return true;
		}

		if (!obj) {
			return false;
		}

		return typeof obj['r'] === 'number' 
			&& typeof obj['g'] === 'number' 
			&& typeof obj['b'] === 'number'
			&& typeof obj['a'] === 'number';
	}

	public static equals(a: RGBA, b: RGBA): boolean {
		return a.r === b.r && a.g === b.g && a.b === b.b && a.a === b.a;
	}

	/**
	 * @description Converts an Hex color text to a {@link RGBA}.
	 * @param str string (#RGB, #RGBA, #RRGGBB or #RRGGBBAA).
	 */
	public static parse(str: string): RGBA | null {
		const length = str.length;

		if (length === 0) {
			return null;
		}

		if (str.charCodeAt(0) !== CharCode.Hash) {
			return null;
		}

		try {
			// #RRGGBB format
			if (length === 7) {
				const r = 16 * __getHexDight(str.charCodeAt(1)) + __getHexDight(str.charCodeAt(2));
				const g = 16 * __getHexDight(str.charCodeAt(3)) + __getHexDight(str.charCodeAt(4));
				const b = 16 * __getHexDight(str.charCodeAt(5)) + __getHexDight(str.charCodeAt(6));
				return new RGBA(r, g, b, 1);
			}

			// #RRGGBBAA format
			if (length === 9) {
				const r = 16 * __getHexDight(str.charCodeAt(1)) + __getHexDight(str.charCodeAt(2));
				const g = 16 * __getHexDight(str.charCodeAt(3)) + __getHexDight(str.charCodeAt(4));
				const b = 16 * __getHexDight(str.charCodeAt(5)) + __getHexDight(str.charCodeAt(6));
				const a = 16 * __getHexDight(str.charCodeAt(7)) + __getHexDight(str.charCodeAt(8));
				return new RGBA(r, g, b, a / 255);
			}

			// #RGB format
			if (length === 4) {
				const r = __getHexDight(str.charCodeAt(1));
				const g = __getHexDight(str.charCodeAt(2));
				const b = __getHexDight(str.charCodeAt(3));
				return new RGBA(16 * r + r, 16 * g + g, 16 * b + b);
			}

			// #RGBA format
			if (length === 5) {
				const r = __getHexDight(str.charCodeAt(1));
				const g = __getHexDight(str.charCodeAt(2));
				const b = __getHexDight(str.charCodeAt(3));
				const a = __getHexDight(str.charCodeAt(4));
				return new RGBA(16 * r + r, 16 * g + g, 16 * b + b, (16 * a + a) / 255);
			}
		} catch {}

		return null;
	}
}

function __toTwoDigitHex(n: number): string {
	const r = n.toString(16);
	return r.length !== 2 ? '0' + r : r;
}

export class HSLA {
	
	// [field]

	/**
	 * Hue: integer in [0, 360]
	 */
	public readonly h: number;

	/**
	 * Saturation: float in [0, 1]
	 */
	public readonly s: number;

	/**
	 * Luminosity: float in [0, 1]
	 */
	public readonly l: number;

	/**
	 * Alpha: float in [0, 1]
	 */
	public readonly a: number;

	// [constructor]

	constructor(h: number, s: number, l: number, a: number) {
		this.h = Math.max(Math.min(360, h), 0) | 0;
		this.s = __roundFloat(Math.max(Math.min(1, s), 0), 3);
		this.l = __roundFloat(Math.max(Math.min(1, l), 0), 3);
		this.a = __roundFloat(Math.max(Math.min(1, a), 0), 3);
	}

	// [public methods]

	@memoize
	public toString(): string {
		if (this.a === 1) {
			return `hsl(${this.h}, ${(this.s * 100).toFixed(2)}%, ${(this.l * 100).toFixed(2)}%)`;
		}
		return `hsla(${this.h}, ${(this.s * 100).toFixed(2)}%, ${(this.l * 100).toFixed(2)}%, ${this.a.toFixed(2)})`;
	}

	public static toString(color: HSLA): string {
		return color.toString();
	}

	public static is(obj: any): obj is HSLA {
		if (obj instanceof HSLA) {
			return true;
		}

		if (!obj) {
			return false;
		}

		return typeof obj['h'] === 'number' 
			&& typeof obj['s'] === 'number' 
			&& typeof obj['l'] === 'number'
			&& typeof obj['a'] === 'number';
	}

	public static equals(a: HSLA, b: HSLA): boolean {
		return a.h === b.h && a.s === b.s && a.l === b.l && a.a === b.a;
	}
	
	/**
	 * @description Converts an RGB color value to HSL. Conversion formula
	 * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
	 * Assumes r, g, and b are contained in the set [0, 255] and
	 * returns h in the set [0, 360], s, and l in the set [0, 1].
	 */
	public static fromRGBA(rgba: RGBA): HSLA {
		const r = rgba.r / 255;
		const g = rgba.g / 255;
		const b = rgba.b / 255;
		const a = rgba.a;

		const max = Math.max(r, g, b);
		const min = Math.min(r, g, b);
		let h = 0;
		let s = 0;
		const l = (min + max) / 2;
		const chroma = max - min;

		if (chroma > 0) {
			s = Math.min((l <= 0.5 ? chroma / (2 * l) : chroma / (2 - (2 * l))), 1);

			switch (max) {
				case r: h = (g - b) / chroma + (g < b ? 6 : 0); break;
				case g: h = (b - r) / chroma + 2; break;
				case b: h = (r - g) / chroma + 4; break;
			}

			h *= 60;
			h = Math.round(h);
		}
		return new HSLA(h, s, l, a);
	}

	/**
	 * @description Converts an HSL color value to RGB. Conversion formula
	 * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
	 * Assumes h in the set [0, 360] s, and l are contained in the set [0, 1] and
	 * returns r, g, and b in the set [0, 255].
	 */
	public static toRGBA(hsla: HSLA): RGBA {
		const h = hsla.h / 360;
		const { s, l, a } = hsla;
		let r: number, g: number, b: number;

		if (s === 0) {
			r = g = b = l; // achromatic
		} else {
			const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
			const p = 2 * l - q;
			r = HSLA._hue2rgb(p, q, h + 1 / 3);
			g = HSLA._hue2rgb(p, q, h);
			b = HSLA._hue2rgb(p, q, h - 1 / 3);
		}

		return new RGBA(Math.round(r * 255), Math.round(g * 255), Math.round(b * 255), a);
	}

	private static _hue2rgb(p: number, q: number, t: number): number {
		if (t < 0) {
			t += 1;
		}
		if (t > 1) {
			t -= 1;
		}
		if (t < 1 / 6) {
			return p + (q - p) * 6 * t;
		}
		if (t < 1 / 2) {
			return q;
		}
		if (t < 2 / 3) {
			return p + (q - p) * (2 / 3 - t) * 6;
		}
		return p;
	}
}

function __getHexDight(char: number): number {
	if (CharCode.Digit0 <= char && char <= CharCode.Digit9) {
		return char - CharCode.Digit0;
	}

	if (CharCode.a <= char && char <= CharCode.z) {
		return char - CharCode.a + 10;
	}

	if (CharCode.A <= char && char <= CharCode.Z) {
		return char - CharCode.A + 10;
	}

	panic(`invalid hex digit ${char}.`);
}

function __roundFloat(number: number, decimalPoints: number): number {
	const decimal = Math.pow(10, decimalPoints);
	return Math.round(number * decimal) / decimal;
}