import 'src/workbench/parts/navigationPanel/navigationView/media/navigationView.scss';
import { Component, IComponent } from 'src/workbench/services/component/component';
import { Emitter, Register } from 'src/base/common/event';
import { IService, createService } from 'src/platform/instantiation/common/decorator';
import { IInstantiationService } from 'src/platform/instantiation/common/instantiation';
import { Constructor } from 'src/base/common/utilities/type';

export const INavigationViewService = createService<INavigationViewService>('navigation-view-service');

export interface INavigationViewChangeEvent {

    /**
     * The current id of the view that is displaying.
     */
    readonly id?: string;

    /**
     * The current displaying view.
     */
    readonly view?: NavView;
}

/**
 * An interface only for {@link navigationViewService}.
 */
export interface INavigationViewService extends IComponent, IService {

    /** 
     * Events fired when the current navigation view has changed. 
     */
    readonly onDidViewChange: Register<INavigationViewChangeEvent>;

    /**
     * @description Register a view with the corresponding ID. The view will not
     * be created immediately.
     * @param id The id of the view for future look up.
     * @param viewCtor The navigation view.
     */
    registerView(id: string, viewCtor: Constructor<NavView>): void;

    /**
     * @description Unregister a view if ever registered.
     * @param id The id of the view.
     * @returns A boolean returned if the operation is succeeded.
     */
    unregisterView(id: string): boolean;

    /**
     * @description Switch to the view by the provided id.
     * @param id The id of the view.
     * @returns The reference to the current switched view.
     */
    switchView(id: undefined): void;
    switchView<TView extends NavView>(id: string): TView;

    /**
     * @description Closes the current view.
     */
    closeView(): void;

    /**
     * @description Returns the current displaying navigation view. Undefined is
     * returned if no views are displaying.
     */
    currView<T extends NavView>(): T | undefined;
}

/**
 * @class The service manages and displays different {@link INavigationView}. It is
 * also a {@link Component}.
 */
export class NavigationView extends Component implements INavigationViewService {

    declare _serviceMarker: undefined;

    // [field]

    /** The current displaying view. */
    private _currView?: NavView;

    /** The container that only contains the {@link INavigationView}. */
    private _viewContainer?: HTMLElement;
    private readonly _cachedView: Map<string, Constructor<NavView> | NavView>;

    // [event]

    private readonly _onDidViewChange = this.__register(new Emitter<INavigationViewChangeEvent>());
    public readonly onDidViewChange = this._onDidViewChange.registerListener;

    // [constructor]

    constructor(
        @IInstantiationService instantiationService: IInstantiationService,
    ) {
        super('navigation-view', null, instantiationService);
        this._cachedView = new Map();
    }

    // [public method]

    public registerView(id: string, viewCtor: Constructor<NavView>): void {
        this.logService.debug('NavigationViewService', `registers a view with ID: ${id}`);

        if (this._cachedView.get(id)) {
            this.logService.warn('NavigationViewService', `The navigation view with ID is already registered: ${id}`);
            return;
        }

        this._cachedView.set(id, viewCtor);
    }

    public unregisterView(id: string): boolean {

        /**
         * If the view is never constructed, we simply delete the registered 
         * constructor.
         */
        const ctor = this._cachedView.get(id);
        if (ctor) {
            this._cachedView.delete(id);
            return true;
        }

        /**
         * If the corresponding view does not exist, returns false indicates
         * the operation fails.
         */
        const view = this.getChild<NavView>(id);
        if (!view) {
            return false;
        }

        /**
         * If the view is created and also displaying currently, switch to any
         * other available views if any, then destroy the view.
         */
        if (id === this._currView?.id) {
            const availableID = this.__getAnyAvailableView();
            if (availableID) {
                this.switchView(availableID);
            } else {
                this.closeView();
            }
        }

        this.__destroyView(id);
        return true;
    }

    public switchView(id: undefined): void;
    public switchView<TView extends NavView>(id: string): TView;
    public switchView<TView extends NavView>(id?: string): TView | void {
        const view = this.__getOrConstructView(id ?? '');
        return <TView>this.__switchView(view);
    }

    public closeView(): void {
        if (this._currView) {
            this.__unloadView(this._currView.id);
        }
        this._onDidViewChange.fire({ id: undefined, view: undefined });
    }

    public currView<T extends NavView>(): T | undefined {
        if (this._currView) {
            return this.getChild<T>(this._currView.id);
        }
        return undefined;
    }

    // [protected override methods]

    protected override __createContent(): void {

        // empty navigation view at the beginning
        this._viewContainer = document.createElement('div');
        this._viewContainer.className = 'navigation-view-container';
        this.element.appendChild(this._viewContainer);
    }

    protected __registerListeners(): void { }

    // [private helper methods]

    private __getOrConstructView<T extends NavView>(id: string): T | undefined {
        const view = this.getChild<T>(id);
        if (view) {
            return view;
        }

        const viewOrCtor = this._cachedView.get(id);
        if (!viewOrCtor) {
            return undefined;
        }

        if (viewOrCtor instanceof NavView) {
            return <T>viewOrCtor;
        }

        const newView = this.instantiationService.createInstance(viewOrCtor, this._viewContainer);
        this._cachedView.delete(id);

        return <T>newView;
    }

    private __switchView(view: NavView | undefined): NavView | void {
        if (!this._viewContainer) {
            return;
        }

        // if no views provided, we treat it as close view.
        if (view === undefined) {
            this.closeView();
            return;
        }

        // switch to the same view, do nothing.
        if (this._currView?.id === view.id) {
            return this._currView;
        }

        // if any view is displaying, unload it first.
        if (this._currView) {
            this.__unloadView(this._currView.id);
        }

        // load the new view
        if (view.isCreated()) {
            view.createInDom(this);
        } else {
            view.create(this);
            view.registerListeners();
        }

        this._currView = this.__register(view);
        this._onDidViewChange.fire({ id: view.id, view: view });

        return view;
    }

    private __unloadView(id: string): void {
        if (!this._viewContainer) {
            return;
        }

        const currView = this.getChild<NavView>(id);
        if (!currView) {
            return;
        }

        currView.detachFromDom();
        this._cachedView.set(id, currView);
        this._currView = undefined;
    }

    private __destroyView(id: string): void {
        const view = this.getChild<NavView>(id);
        if (view) {
            view.dispose();
        }
    }

    private __getAnyAvailableView(): string | undefined {
        const children = this.getChildren();
        if (children[0] === undefined) {
            return undefined;
        }
        return children[0][0];
    }
}

/**
 * An interface only for {@link NavigationView}.
 */
export interface INavView extends IComponent {

    /**
     * The ID of the view.
     */
    readonly id: string;
}

/**
 * @class The base class to be inherited from to be inserted into 
 * {@link NavigationView}.
 */
export abstract class NavView extends Component implements INavView {

    // [field]

    public static readonly HEIGHT = 300;

    protected __registerListeners(): void { }
}