export interface IDimension extends ISize {}
export interface ISize {
	width: number;
	height: number;
}

export interface IMeasurable {
	size: number;
}

export interface IPosition {
	top: number;
	left: number;
}

export interface ICoordinate {
	x: number;
	y: number;
}

export interface IDomBox extends IPosition, IDimension {}
export interface IRect extends IDomBox {}

interface ISize2D {
	clone(a: number, b: number): this;
	equals(other: this): boolean;
	scale(factor: number): this;
	add(other: this): this;
	subtract(other: this): this;
}

class Size2D {
	
	constructor(
		protected _a: number,
		protected _b: number,
	) { }

	public clone(a: number = this._a, b: number = this._b): this {
		return new (<any>this.constructor)(a, b);
	}

	public equals(other: this): boolean {
		if (other === this) {
			return true;
		}
		return other._a === this._a && other._b === this._b;
	}

	public scale(factor: number): this {
        return new (<any>this.constructor)(this._a * factor, this._b * factor);
    }

    public add(other: this): this {
        return new (<any>this.constructor)(this._a + other._a, this._b + other._b);
    }

    public subtract(other: this): this {
        return new (<any>this.constructor)(this._a - other._a, this._b - other._b);
    }
}

export class Dimension extends Size2D implements Readonly<IDimension>, ISize2D {

	public static readonly None = new Dimension(0, 0);

	constructor(width: number, height: number) {
		super(width, height);
	}

	get width(): number {
		return this._a;
	}
	
	get height(): number {
		return this._b;
	}

	public static is(other: any): other is Dimension {
		return other instanceof Dimension;
	}

	public static lift(obj: IDimension): Dimension {
		if (obj instanceof Dimension) {
			return obj;
		}
		return new (<any>this.constructor)(obj.width, obj.height);
	}
}

export class Position extends Size2D implements Readonly<IPosition>, ISize2D {

	public static readonly None = new Position(0, 0);

	constructor(top: number, left: number) {
		super(top, left);
	}

	get top(): number {
		return this._a;
	}
	
	get left(): number {
		return this._b;
	}

	public static is(other: any): other is Position {
		return other instanceof Position;
	}

	public static lift(obj: IPosition): Position {
		if (obj instanceof Position) {
			return obj;
		}
		return new (<any>this.constructor)(obj.top, obj.left);
	}
}

export class Coordinate extends Size2D implements Readonly<ICoordinate>, ISize2D {

	public static readonly None = new Coordinate(0, 0);

	constructor(x: number, y: number) {
		super(x, y);
	}

	get x(): number {
		return this._a;
	}
	
	get y(): number {
		return this._b;
	}

	public static is(other: any): other is Coordinate {
		return other instanceof Coordinate;
	}

	public static lift(obj: ICoordinate): Coordinate {
		if (obj instanceof Coordinate) {
			return obj;
		}
		return new (<any>this.constructor)(obj.x, obj.y);
	}
}