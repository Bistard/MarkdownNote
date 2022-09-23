import { DisposableManager, IDisposable } from "src/base/common/dispose";
import { DomEmitter, EventType } from "src/base/browser/basic/dom";
import { createService } from "src/code/platform/instantiation/common/decorator";
import { Event, Register } from "src/base/common/event";
import { createStandardKeyboardEvent, IStandardKeyboardEvent } from "src/base/common/keyboard";

export const IKeyboardService = createService<IKeyboardService>('keyboard-service');

export interface IKeyboardService {
    
    dispose(): void;

    /**
     * Fires when keydown happens.
     */
    onKeydown: Register<IStandardKeyboardEvent>;
    
    /**
     * Fires when keyup happens.
     */
    onKeyup: Register<IStandardKeyboardEvent>;
}

/**
 * @class A brower-side keyboard listener. All the key press will be converted 
 * into {@link IStandardKeyboardEvent} instead of raw {@link KeyboardEvent}.
 * 
 * The reason to convert the events is mainly due to different operating system 
 * may have different keycode with the same key pressed.
 */
export class keyboardService implements IDisposable, IKeyboardService {

    private readonly disposables: DisposableManager;

    private readonly _onKeydown = new DomEmitter<KeyboardEvent>(window, EventType.keydown);
    public readonly onKeydown = Event.map<KeyboardEvent, IStandardKeyboardEvent>(this._onKeydown.registerListener, e => createStandardKeyboardEvent(e));

    private readonly _onKeyup = new DomEmitter<KeyboardEvent>(window, EventType.keyup);
    public readonly onKeyup = Event.map<KeyboardEvent, IStandardKeyboardEvent>(this._onKeyup.registerListener, e => createStandardKeyboardEvent(e));

    constructor() {
        this.disposables = new DisposableManager();
        this.disposables.register(this._onKeydown);
        this.disposables.register(this._onKeyup);
    }

    public dispose(): void {
        this.disposables.dispose();
    }

}
