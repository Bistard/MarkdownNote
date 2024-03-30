import { FastElement } from "src/base/browser/basic/fastElement";
import { DomUtility, EventType, Orientation, addDisposableListener } from "src/base/browser/basic/dom";
import { Emitter, Priority, Register } from "src/base/common/event";
import { Dimension, IDimension } from "src/base/common/utilities/size";
import { IComponentService } from "src/workbench/services/component/componentService";
import { Themable } from "src/workbench/services/theme/theme";
import { FocusTracker } from "src/base/browser/basic/focusTracker";
import { IThemeService } from "src/workbench/services/theme/themeService";
import { assert, panic } from "src/base/common/utilities/panic";
import { ISplitView, ISplitViewOpts, SplitView } from "src/base/browser/secondary/splitView/splitView";

export interface ICreatable {
    create(): void;
    registerListeners(): void;
}

export interface IComponentsConfiguration {
    component: any;
    minSize: number;
    maxSize: number;
    initSize: number;
    priority: Priority;
}

/**
 * An interface only for {@link Component}.
 */
export interface IComponent extends ICreatable {

    /**
     * @description Returns the string id of the component.
     */
    readonly id: string;

    /** Fires when the component is focused or blurred (true represents focused). */
    readonly onDidFocusChange: Register<boolean>;

    /** Fires when the component visibility is changed. */
    readonly onDidVisibilityChange: Register<boolean>;

    /** Fires when the component is layouting. */
    readonly onDidLayout: Register<IDimension>;

    /** The parent {@link IComponent} of the current component. */
    readonly parentComponent: IComponent | undefined;

    /** The parent {@link HTMLElement} of the current component. */
    readonly parent: HTMLElement | undefined;

    /** The DOM element of the current component. */
    readonly element: FastElement<HTMLElement>;

    /**
     * @description Renders the component itself.
     * @param parentComponent If provided, the component will be registered 
     *                        under this component. If no parentElement is 
     *                        provided, the component will be rendered under 
     *                        this parent component.
     * @note If both not provided, either renders under the constructor provided 
     * element, or `document.body`.
     */
    create(parentComponent?: IComponent): void;

    /**
     * @description Layout the component to the given dimension.
     * @param width The width of dimension.
     * @param height The height of dimension.
     * @note If no dimensions is provided, the component will try to be filled
     * with the parent HTMLElement. If any dimensions is provided, the component
     * will layout the missing one either with the previous value or just zero.
     */
    layout(width?: number, height?: number): void;

    /**
     * @description Registers any listeners in the component.
     */
    registerListeners(): void;

    /**
     * @description Register a child {@link IComponent} into the current Component.
     * @param override If sets to true, it will override the existed one which 
     *                 has the same component id. Defaults to false.
     * 
     * @warn Throws an error if the component has already been registered and
     *       override sets to false.
     */
    registerComponent(component: IComponent, override?: boolean): void;

    /**
     * @description Determines if the component with the given id has been 
     * registered in the current component.
     * @param id The id of the component.
     * 
     * @returns If the component founded.
     */
    hasComponent(id: string): boolean;

    /**
     * @description Returns the sub component by id.
     * @param id The string ID of the component.
     * @returns The required Component.
     * @warn If no such component exists, an error throws.
     */
    getComponent<T extends IComponent>(id: string): T | undefined;

    /**
     * @description Unregister the component with the given id.
     * @param id The id of the component.
     * @note The corresponding component will not be disposed automatically.
     */
    unregisterComponent(id: string): void;

    /**
     * @description Returns all the registered components that as the direct
     * children of the current component.
     */
    getDirectComponents(): [string, IComponent][];

    /**
     * @description Sets the visibility of the current component.
     * @param value to visible or invisible.
     */
    setVisible(value: boolean): void;

    /**
     * @description Sets if to focus the current component.
     * @param value To focus or blur.
     */
    setFocusable(value: boolean): void;

    /**
     * @description Checks if the component has created.
     */
    created(): boolean;

    /**
     * @description Disposes the current component and all its children 
     * components.
     */
    dispose(): void;
}

/**
 * @class An abstract base class for UI components, providing structure and 
 * common functionality.
 * 
 * @note It encapsulates element creation, layout management, focus tracking, 
 * and component registration. Subclasses should implement the abstract methods:
 *      1. `_createContent()` for content creation and
 *      2. `_registerListeners()` for event listener registration.
 * 
 * @note The class also offers methods for component lifecycle management, 
 * visibility control, and layout adjustments.
 * 
 * @note A component is disposable, once it get disposed, all its children will
 * also be disposed. The component cannot be disposed / create() / 
 * registerListener() twice.
 */
export abstract class Component extends Themable implements IComponent {

    // [field]

    private _parentComponent?: IComponent;
    private _parentElement?: HTMLElement;

    private readonly _element: FastElement<HTMLElement>;
    private readonly _children: Map<string, IComponent>;
    private _dimension?: Dimension;

    private readonly _focusTracker: FocusTracker;

    private _created: boolean;
    private _registered: boolean;
    
    private _splitView: ISplitView | undefined;

    // [event]

    public readonly onDidFocusChange: Register<boolean>;

    private readonly _onDidVisibilityChange = this.__register(new Emitter<boolean>());
    public readonly onDidVisibilityChange = this._onDidVisibilityChange.registerListener;

    private readonly _onDidLayout = this.__register(new Emitter<IDimension>());
    public readonly onDidLayout = this._onDidLayout.registerListener;

    // [constructor]

    /**
     * @param id The id for the Component.
     * @param parentElement If provided, parentElement will replace the 
     * HTMLElement from the provided parentComponent when creating. Otherwise 
     * defaults to `document.body`.
     */
    constructor(
        id: string,
        parentElement: HTMLElement | null,
        themeService: IThemeService,
        componentService: IComponentService,
    ) {
        super(themeService);

        this._created = false;
        this._registered = false;
        this._children = new Map();

        this._element = new FastElement(document.createElement('div'));
        this._element.setID(id);

        this._focusTracker = this.__register(new FocusTracker(this._element.element, false));
        this.onDidFocusChange = this._focusTracker.onDidFocusChange;

        if (parentElement) {
            this._parentElement = parentElement;
        }
        componentService.register(this);
    }

    // [getter]

    get parentComponent() { return this._parentComponent; }

    get parent() { return this._parentElement; }

    get element() { return this._element; }

    get dimension() { return this._dimension; }

    // [abstract method]

    /**
     * @description if needed, this function will be called inside the function
     * '_createContainer()' to create the actual content of the component.
     * 
     * subclasses should override this function.
     */
    protected abstract _createContent(): void;

    /**
     * @description to register listeners for the component and its content.
     * 
     * subclasses should override this function.
     */
    protected abstract _registerListeners(): void;

    // [protected override method]

    protected override __updateStyles(): void { /** noop */ }

    // [public method]

    get id(): string {
        return this._element.getID();
    }

    public create(parentComponent?: IComponent): void {
        if (this._created || this.isDisposed()) {
            return;
        }

        if (parentComponent) {
            this._parentComponent = parentComponent;
            parentComponent.registerComponent(this);
        }

        // actual rendering
        this._parentElement = parentComponent?.element.element ?? this._parentElement ?? document.body;
        this._parentElement.appendChild(this._element.element);

        // rendering the content
        this._createContent();
        this._created = true;
    }

    public layout(width?: number, height?: number): void {
        if (!this._parentElement) {
            return;
        }

        // If no dimensions provided, we default to layout to fit to parent.
        if (typeof width === 'undefined' && typeof height === 'undefined') {
            this._dimension = DomUtility.Positions.getClientDimension(this._parentElement);
            this._element.setWidth(this._dimension.width);
            this._element.setHeight(this._dimension.height);
        }

        // If any dimensions is provided, we force to follow it.
        else {
            this._dimension = this._dimension
                ? this._dimension.clone(width, height)
                : new Dimension(width ?? 0, height ?? 0)
            ;
            this._element.setWidth(this._dimension.width);
            this._element.setHeight(this._dimension.height);
        }

        this._onDidLayout.fire(this._dimension);
    }

    public registerListeners(): void {
        if (this.isDisposed() || this._registered || !this._created) {
            return;
        }

        this._registerListeners();
        this._registered = true;
    }

    public registerComponent(component: IComponent, override: boolean = false): void {
        const id = component.id;
        const registered = this._children.has(id);

        if (registered) {
            if (!override) {
                panic('component has been already registered');
            }
            const deprecated = this._children.get(id)!;
            deprecated.dispose();
        }

        this._children.set(id, component);
        this.__register(component);
    }

    public created(): boolean {
        return this._created;
    }

    public setVisible(value: boolean): void {

        if (value === true) {
            this._element.setVisibility('visible');
        } else {
            this._element.setVisibility('hidden');
        }

        this._onDidVisibilityChange.fire(value);
    }

    public setFocusable(value: boolean): void {
        this._focusTracker.setFocusable(value);
    }

    public hasComponent(id: string): boolean {
        return this._children.has(id);
    }

    public getComponent<T extends IComponent>(id: string): T | undefined {
        const component = this._children.get(id);
        if (!component) {
            return undefined;
        }
        return <T>component;
    }

    public unregisterComponent(id: string): void {
        this._children.delete(id);
    }

    public getDirectComponents(): [string, IComponent][] {
        const result: [string, IComponent][] = [];
        for (const entry of this._children) {
            result.push(entry);
        }
        return result;
    }

    public override dispose(): void {
        super.dispose();
        for (const [id, child] of this._children) {
            child.dispose();
        }
    }

    public assembleComponents(orientation: Orientation, configurations: IComponentsConfiguration[]): void {
        if (this._splitView) {
            panic("Cannot apply the function `` twice. ");
        }
    
        const splitViewOpt: Required<ISplitViewOpts> = {
            orientation,
            viewOpts: [],
        };
    
        for (const config of configurations) {
            const { component, minSize, maxSize, initSize, priority } = config;
            component.create(this);
            component.registerListeners();
    
            splitViewOpt.viewOpts.push({
                element: component.element,
                minimumSize: minSize,
                maximumSize: maxSize,
                initSize,
                priority,
            });
        }
    
        // construct the split-view
        this._splitView = this.__register(new SplitView(this.element.element, splitViewOpt));
    
        // TODO: apply sash configuration
    
        // set the sash next to sideBar is visible and disabled.
        const sash = assert(this._splitView.getSashAt(0));
        sash.enable = false;
        sash.visible = true;
        sash.size = 1;
    
        // register listeners
        this.__register(addDisposableListener(window, EventType.resize, () => {
            this.layout();
            const _dimension = assert(this.dimension);
            this._splitView?.layout(_dimension.width, _dimension.height);
        }));
    }    
}
