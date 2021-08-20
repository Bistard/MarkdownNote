import { ActionViewType } from 'mdnote';
import { getSvgPathByName } from 'src/base/common/string';
import { Component, ComponentType } from 'src/code/workbench/browser/component';
import { IRegisterService } from 'src/code/workbench/service/registerService';
import { FolderViewComponent } from "src/code/workbench/browser/actionView/folder/folder";
import { IEventEmitter } from 'src/base/common/event';

export enum ActionViewComponentType {
    FolderView = 'folder-container',
    OutlineView = 'outline-container',
    SearchView = 'search-container',
    GitView = 'git-container',
}

/**
 * @description ActionViewComponent displays different action view such as 
 * folderView, outlineView, gitView and so on.
 */
export class ActionViewComponent extends Component {

    public whichActionView: ActionViewType;
    
    private actionViewContentContainer!: HTMLElement;
    private resize!: HTMLElement;
    private actionViewTop!: HTMLElement;
    private actionViewContent!: HTMLElement;

    private folderViewComponent!: FolderViewComponent;
    private _eventEmitter: IEventEmitter;
    // Others...

    constructor(registerService: IRegisterService,
                _eventEmitter: IEventEmitter    
    ) {
        super(ComponentType.ActionView, registerService);
        
        this._eventEmitter = _eventEmitter;
        this.whichActionView = 'none';
    }

    protected override _createContainer(): void {
        this.parent.appendChild(this.container);
        // customize...
        this._createContentArea();
    }

    protected override _createContentArea(): void {
        this.contentArea = document.createElement('div');
        this.contentArea.id = 'action-view-container';
        
        this.actionViewContentContainer = document.createElement('div');
        this.actionViewContentContainer.id = 'action-content-container';

        this.resize = document.createElement('div');
        this.resize.id = 'resize';
        this.resize.classList.add('resizeBtn-style', 'vertical-center');

        this.actionViewTop = this._createActionViewTop();
        this.actionViewContent = this._createActionViewContent();

        this.actionViewContentContainer.appendChild(this.actionViewTop);
        this.actionViewContentContainer.appendChild(this.actionViewContent);
        
        this.contentArea.appendChild(this.actionViewContentContainer);
        this.contentArea.appendChild(this.resize);
        
        this.container.appendChild(this.contentArea);

    }

    protected override _registerListeners(): void {

        this.folderViewComponent.registerListeners();

        this._eventEmitter.register('onActionViewChange', (name) => this.onActionViewChange(name));
        this._eventEmitter.register('onActionViewOpen', () => this.openActionView());
        this._eventEmitter.register('onActionViewClose', () => this.closeActionView());
    }

    private _createActionViewTop(): HTMLElement {
        const actionViewTop = document.createElement('div');
        actionViewTop.id = 'action-view-top';

        const topText = document.createElement('div');
        topText.id = 'action-view-top-text';
        topText.innerHTML = 'Notebook';
        topText.classList.add('pureText', 'captialize');

        const topIcon = document.createElement('img');
        topIcon.id = 'action-view-top-icon';
        topIcon.src = getSvgPathByName('three-dots');
        topIcon.classList.add('vertical-center', 'filter-white');

        actionViewTop.appendChild(topText);
        actionViewTop.appendChild(topIcon);
        return actionViewTop;
    }

    // TODO: only render the view (DOM elements) when it is actually in is visible to user
    private _createActionViewContent(): HTMLElement {
        const actionViewContent = document.createElement('div');
        actionViewContent.id = 'action-view-content';
        
        this.folderViewComponent = new FolderViewComponent(this);
        this.folderViewComponent.create(actionViewContent);

        // outlineViewComponent...
        
        // searchViewComponent...

        // gitViewComponent...

        // settingViewComponent...

        return actionViewContent;
    }

    /**
     * @description switch to that action view given a specific name.
     */
    public onActionViewChange(actionViewName: ActionViewType): void {
        if (actionViewName === this.whichActionView) {
            return;
        }
        
        this.actionViewTopTextOnChange(actionViewName);
        this.hideActionViewContent();
        
        if (actionViewName === 'folder') {
            $('#folder-container').show(0);
        } else if (actionViewName === 'outline') {
            $('#outline-container').show(0);
        } else if (actionViewName === 'search') {
            $('#search-container').show(0);
        } else if (actionViewName === 'git') {
            $('#git-container').show(0);
        } else {
            throw 'error';
        }

        this.whichActionView = actionViewName;
    }

    /**
     * @description display given text on the action view top.
     */
    public actionViewTopTextOnChange(name: string): void {
        if (name == 'folder') {
            $('#action-view-top-text').html('Notebook');
        } else if (name == 'git') {
            $('#action-view-top-text').html('Git Control');
        } else {
            $('#action-view-top-text').html(name);
        }
    }

    /**
     * @description simple function for hiding the current content of action view.
     */
    public hideActionViewContent(): void {
        $('#action-view-content').children().each(function() {
            $(this).hide(0);
        });
    }

    /**
     * @description NOT displaying action view.
     */
    public closeActionView(): void {
        $('#action-view').hide(0);
        $('#resize').hide(0);
    }
    
    /**
     * @description displays action view.
     */
    public openActionView(): void {
        $('#action-view').show(0);
        $('#resize').show(0);
    }

}
