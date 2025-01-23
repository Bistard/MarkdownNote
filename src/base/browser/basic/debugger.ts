import { Direction, DirectionX, DirectionY } from "src/base/browser/basic/dom";
import { Color } from "src/base/common/color";
import { Time } from "src/base/common/date";
import { IDisposable, toDisposable, untrackDisposable } from "src/base/common/dispose";
import { delayFor } from "src/base/common/utilities/async";
import { panic } from "src/base/common/utilities/panic";
import { ICoordinate } from "src/base/common/utilities/size";

/**
 * The {@link UIDebugger} singleton is a debugging tool designed for visualizing
 * points and lines on the UI.
 * 
 * This tool is particularly useful when rendering errors occur, and simply 
 * logging incorrect coordinates (x/y) in the console does not provide enough 
 * context. By passing the problematic coordinates or elements to 
 * {@link UIDebugger}, developers can better understand and debug the issue 
 * through visual feedback.
 * 
 * Example Use Case
 * If a UI element appears misaligned or misplaced, you can use {@link UIDebugger}
 * to mark the expected and actual positions of the element for easier 
 * troubleshooting.
 */
export interface IUIDebugger {
    
    /**
     * @description Displays a visual representation of a point on the 
     * destination.
     *
     * @param id A unique identifier for the point. If a point with the same ID 
     *           already exists, it will be replaced.
     * @param point Different ways to represent a point.
     * @returns An `IDisposable` instance that can be used to manually remove 
     *          the point.
     */
    showPoint(id: string, point: PointRepresentation): IDisposable;

    /**
     * @description Displays a visual representation of a line on the UI.
     *
     * @param id A unique identifier for the point. If a point with the same ID 
     *           already exists, it will be replaced.
     * @param line Different ways to represent a line.
     * @returns An `IDisposable` instance that can be used to manually remove 
     *          the line.
     */
    showLine(id: string, line: LineRepresentation): IDisposable;
    
    /**
     * @description Clears all active visual markers from the UI.
     */
    clearAll(): void;
}

export type PointRepresentation = BaseRepresentationOptions & 
    { 
        /**
         * The radius of the point.
         * @default 5
         */
        readonly radius?: number; 
    } & (
        // alternative 1
        { 
            /**
             * The point rendered based on a coordinate.
             */
            readonly coordinate: ICoordinate; 
        } | 
        // alternative 2
        { 
            /**
             * The point rendered at the centered of the given element.
             */
            readonly element: HTMLElement; 
        }
    );

export type LineRepresentation = BaseRepresentationOptions & (
{ 
    // alternative 1

    /**
     * Specifies the starting coordinates of the line.
     */
    readonly coordinate1: ICoordinate;
    /**
     * Specifies the ending coordinates of the line.
     */
    readonly coordinate2: ICoordinate;
} | 
{ 
    // alternative 2
    
    /**
     * The starting coordinate of the line.
     */
    readonly coordinate: ICoordinate;
    /**
     * The length of the line.
     */
    readonly length: number;
    /**
     * The angle of the line relative to the X-axis (not in radians).
     */
    readonly angle: number;
} | 
{
    // alternative 3

    /**
     * The target element for the line to be attached.
     */
    readonly element: HTMLElement;
    /**
     * The edge of the element where the line will be drawn.
     */
    readonly whichEdge: Direction;
});

type BaseRepresentationOptions = {
    /**
     * An optional element to which the coordinates are relative. If not 
     * specified, coordinates are relative to the viewport.
     */
    readonly relativeTo?: HTMLElement;
    /**
     * The {@link Time} after which the visual marker will be automatically 
     * removed. If not specified, the marker will persist until manually 
     * disposed or {@link clearAll()} is called.
     */
    readonly timeout?: Time;

    /**
     * Indicates the color of the marker.
     */
    readonly color?: Color;
};

export const UIDebugger: IUIDebugger = new class {
    
    // [fields]

    private readonly _container: HTMLElement;
    private readonly _actives: Map<string, IDisposable>;

    // [constructor]

    constructor() {
        this._actives = new Map();

        const div = document.createElement('div');
        Object.assign(div.style, {
            position: 'fixed',
            top: '0px',
            left: '0px',
            width: '100vw',
            height: '100vh',
            pointerEvents: 'none',
            zIndex: 100,
        });

        document.body.appendChild(div);
        this._container = div;
    }

    // [public methods]

    public clearAll(): void {
        for (const [id, lifecycle] of this._actives) {
            lifecycle.dispose();
        }
    }

    public showPoint(id: string, point: PointRepresentation): IDisposable {
        const marker = document.createElement('div');
        Object.assign(marker.style, {
            position: 'absolute',
            pointerEvents: 'none',
            zIndex: 1000,
            borderRadius: '50%',
            backgroundColor: point.color?.toString() ?? Color.random().toString(),
        });

        const radius = point.radius || 5;
        marker.style.width = `${radius * 2}px`;
        marker.style.height = `${radius * 2}px`;

        if ('coordinate' in point) {
            const { coordinate } = point;
            marker.style.left = `${coordinate.x - radius}px`;
            marker.style.top = `${coordinate.y - radius}px`;
        } else if ('element' in point) {
            const { element } = point;
            const rect = element.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            marker.style.left = `${centerX - radius}px`;
            marker.style.top = `${centerY - radius}px`;
        }

        // relativeTo option
        if (point.relativeTo) {
            point.relativeTo.appendChild(marker);
        } else {
            this._container.appendChild(marker);
        }

        // timeout option
        if (point.timeout) {
            delayFor(point.timeout, () => unrender.dispose());
        }

        // unrender
        const unrender = this.__genUnregister(id, marker);
        return unrender;
    }

    public showLine(id: string, line: LineRepresentation): IDisposable {
        const lineEl = document.createElement('div');
        Object.assign(lineEl.style, {
            position: 'absolute',
            pointerEvents: 'none',
            zIndex: 1000,
            backgroundColor: line.color?.toString() ?? Color.random().toString(),
        });

        /**
         * starting point: (x1, y1)
         * ending point: (x2, y2)
         */
        let x1!: number, y1!: number, x2!: number, y2!: number;

        // 1) two coordinates
        if ('coordinate1' in line && 'coordinate2' in line) {
            x1 = line.coordinate1.x;
            y1 = line.coordinate1.y;
            x2 = line.coordinate2.x;
            y2 = line.coordinate2.y;
        } 
        // 2) starting + length + angle
        else if ('length' in line && 'angle' in line) {
            const { coordinate, length, angle } = line;
            const rad = angle * Math.PI / 180;
            x1 = coordinate.x;
            y1 = coordinate.y;
            x2 = coordinate.x + length * Math.cos(rad);
            y2 = coordinate.y + length * Math.sin(rad);
        } 
        // 3) element + whichEdge
        else if ('element' in line && 'whichEdge' in line) {
            const { element, whichEdge } = line;
            const rect = element.getBoundingClientRect();
            switch (whichEdge) {
                case DirectionY.Top:
                    x1 = rect.left;
                    y1 = rect.top;
                    x2 = rect.right;
                    y2 = rect.top;
                    break;
                case DirectionY.Bottom:
                    x1 = rect.left;
                    y1 = rect.bottom;
                    x2 = rect.right;
                    y2 = rect.bottom;
                    break;
                case DirectionX.Left:
                    x1 = rect.left;
                    y1 = rect.top;
                    x2 = rect.left;
                    y2 = rect.bottom;
                    break;
                case DirectionX.Right:
                    x1 = rect.right;
                    y1 = rect.top;
                    x2 = rect.right;
                    y2 = rect.bottom;
                    break;
            }
        } else {
            panic('Invalid LineRepresentation');
        }

        // calc: line length
        const dx = x2 - x1;
        const dy = y2 - y1;
        const lineLength = Math.sqrt(dx * dx + dy * dy);
        const lineAngle = Math.atan2(dy, dx);

        // rendering
        const thickness = 2;
        lineEl.style.width = `${lineLength}px`;
        lineEl.style.height = `${thickness}px`;
        lineEl.style.left = `${x1}px`;
        lineEl.style.top = `${y1 - thickness / 2}px`; // centrialize the line, cut the half.

        // rotation
        const deg = (lineAngle * 180) / Math.PI;
        lineEl.style.transformOrigin = `0px ${thickness / 2}px`;
        lineEl.style.transform = `rotate(${deg}deg)`;

        // relative option
        if (line.relativeTo) {
            line.relativeTo.appendChild(lineEl);
        } else {
            this._container.appendChild(lineEl);
        }

        // timeout option
        if (line.timeout) {
            delayFor(line.timeout, () => unrender.dispose());
        }

        // unrender
        const unrender = this.__genUnregister(id, lineEl);
        return unrender;
    }

    private __genUnregister(id: string, div: HTMLElement): IDisposable {
        const existed = this._actives.get(id);
        if (existed) {
            existed.dispose();
        }
        
        let removed = false;
        const unrender = untrackDisposable(toDisposable(() => {
            if (removed) {
                return;
            }
            removed = true;

            div.remove();
            this._actives.delete(id);
        }));

        this._actives.set(id, unrender);
        return unrender;
    }

    private __unrender(id: string): boolean {
        const disposable = this._actives.get(id);
        if (disposable) {
            disposable.dispose();
            return true;
        }
        return false;
    }
};