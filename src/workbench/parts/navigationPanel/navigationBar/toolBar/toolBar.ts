import 'src/workbench/parts/navigationPanel/navigationBar/toolBar/media/toolBar.scss';
import { IService, createService } from 'src/platform/instantiation/common/decorator';
import { Component, IComponent } from 'src/workbench/services/component/component';
import { IComponentService } from 'src/workbench/services/component/componentService';
import { IThemeService } from 'src/workbench/services/theme/themeService';
import { ILogService } from 'src/base/common/logger';
import { Emitter, Register } from 'src/base/common/event';
import { ActionBar } from 'src/workbench/parts/navigationPanel/navigationBar/toolBar/actionBar';
import { FilterBar } from 'src/workbench/parts/navigationPanel/navigationBar/toolBar/filterBar';
import { IInstantiationService } from 'src/platform/instantiation/common/instantiation';
import { IButtonOptions } from 'src/base/browser/basic/button/button';

export const IToolBarService = createService<IToolBarService>('tool-bar-service');

export const enum ToolBarType {
    Action,
    Filter
}

export interface IToolBarService extends IComponent, IService {
    readonly onDidStateChange: Register<ToolBarType>;

    switchTo(type: ToolBarType): void;

    /**
     * @description Register icon buttons for the toolbar (delegated to ActionBar).
     * @param opts Button options
     */
    registerButton(opts: IButtonOptions): boolean;
}

export class ToolBar extends Component implements IToolBarService {

    declare _serviceMarker: undefined;

    public static readonly HEIGHT = 60;

    private _currentState: ToolBarType;
    private readonly _actionBar: ActionBar;
    private readonly _filterBar: FilterBar;

    private readonly _onDidStateChange = this.__register(new Emitter<ToolBarType>());
    public readonly onDidStateChange = this._onDidStateChange.registerListener;

    constructor(
        @IComponentService componentService: IComponentService,
        @IThemeService themeService: IThemeService,
        @ILogService logService: ILogService,
        @IInstantiationService instantiationService: IInstantiationService,
    ) {
        super("tool-bar", null, themeService, componentService, logService);
        this._actionBar = instantiationService.createInstance(ActionBar);
        this._filterBar = instantiationService.createInstance(FilterBar);
        this._currentState = ToolBarType.Action;
    }

    public switchTo(barType: ToolBarType): void {
        switch (barType) {
            case ToolBarType.Action:
                this._filterBar.setVisible(false);
                this._actionBar.setVisible(true);
                break;
            case ToolBarType.Filter:
                this._filterBar.setVisible(true);
                this._actionBar.setVisible(false);
                break;
        }

        this._currentState = barType;
        this._onDidStateChange.fire(this._currentState);
    }

    public registerButton(opts: IButtonOptions): boolean {
        return this._actionBar.registerButton(opts);
    }

    protected override _createContent(): void {
        this._actionBar.create(this);
        this._filterBar.create(this);
        this.switchTo(ToolBarType.Action);
    }

    protected override _registerListeners(): void {

    }
}
