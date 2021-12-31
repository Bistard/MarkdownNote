import { Component } from 'src/code/browser/workbench/component';
import { WindowBarComponent } from 'src/code/browser/workbench/editor/titleBar/windowBar';
import { FunctionBarComponent } from 'src/code/browser/workbench/editor/titleBar/functionBar';
import { EditorComponentType } from 'src/code/browser/workbench/editor/editor';
import { IComponentService } from 'src/code/browser/service/componentService';
import { IUserConfigService } from 'src/code/common/service/configService/configService';

export enum TitleBarComponentType {
    functionBar = 'function-bar',
    windowBar = 'window-bar',
}

/**
 * @description TitleBarComponent stores and handles all the titleBar and functionBar 
 * relevant business. 
 */
export class TitleBarComponent extends Component {
    
    functionBarComponent!: FunctionBarComponent;
    windowBarComponent!: WindowBarComponent;

    constructor(
        parentComponent: Component,
        @IComponentService componentService: IComponentService,
    ) {
        super(EditorComponentType.titleBar, parentComponent, null, componentService);
    }

    protected override _createContent(): void {
        
        this._createfunctionBar();
        this._createWindowBar();
        
    }

    protected override _registerListeners(): void {
        
        // component registration
        this.functionBarComponent.registerListeners();
        this.windowBarComponent.registerListeners();
        
    }

    private _createfunctionBar(): void {
        this.functionBarComponent = new FunctionBarComponent(this, this.componentService);
        this.functionBarComponent.create();
    }

    private _createWindowBar(): void {
        this.windowBarComponent = new WindowBarComponent(this, this.componentService);
        this.windowBarComponent.create();
    }
    
}
