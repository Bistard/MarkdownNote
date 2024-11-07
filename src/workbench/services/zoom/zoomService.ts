import { Disposable } from "src/base/common/dispose";
import { Emitter, Register } from "src/base/common/event";
import { Numbers } from "src/base/common/utilities/number";
import { webFrame } from "src/platform/electron/browser/global";
import { createService, IService } from "src/platform/instantiation/common/decorator";

export const IBrowserZoomService = createService<IBrowserZoomService>('browser-zoom-service');

/**
 * An interface only for {@link BrowserZoomService}.
 */
export interface IBrowserZoomService extends IService {

    /**
     * Fires whenever the zoom level changes. The number represents the zoom 
     * level between -8 to 8 (default is 0).
     */
    readonly onDidZoomLevelChange: Register<number>;

    /**
     * @param level If not given, set to default 1.
     */
    setZoomLevel(level?: number): void;
    getZoomLevel(): number;
    zoomIn(): void;
    zoomOut(): void;
}

/**
 * @class Manages browser zoom levels, allowing control over zoom in, zoom out, 
 * and setting specific zoom levels. It also emits events when the zoom level 
 * changes.
 */
export class BrowserZoomService extends Disposable implements IBrowserZoomService {

    declare _serviceMarker: undefined;

    private _level: number;
    private readonly _onDidZoomLevelChange = this.__register(new Emitter<number>());
    public readonly onDidZoomLevelChange = this._onDidZoomLevelChange.registerListener;

    constructor() {
        super();
        this._level = webFrame.getZoomLevel();
    }

    public getZoomLevel(): number {
        return this._level;
    }

    public setZoomLevel(level?: number): void {
        level ??= 0;

        if (level === this._level) {
            return;
        }

        this.__doSetZoomLevel(Numbers.clamp(level, -8, 8));
    }

    public zoomIn(): void {
        this._level = Math.min(8, this._level + 1);
        this.__doSetZoomLevel(this._level);
    }
    
    public zoomOut(): void {
        this._level = Math.max(-8, this._level - 1);
        this.__doSetZoomLevel(this._level);
    }

    private __doSetZoomLevel(level: number): void {
        webFrame.setZoomLevel(level);
        this._onDidZoomLevelChange.fire(level);
    }
}