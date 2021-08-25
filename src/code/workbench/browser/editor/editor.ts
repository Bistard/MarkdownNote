import { Component, ComponentType } from "src/code/workbench/browser/component";
import { MarkdownComponent } from "src/code/workbench/browser/editor/markdown/markdown";
import { TitleBarComponent } from "src/code/workbench/browser/editor/titleBar/titleBar";
import { IRegisterService } from "src/code/workbench/service/registerService";

export enum EditorComponentType {
    tabBar = 'tab-bar',
    titleBar = 'title-bar',
    toolBar = 'tool-bar',
    windowBar = 'window-bar',
}

export class EditorComponent extends Component {

    private titleBarComponent!: TitleBarComponent;
    private markdownComponent!: MarkdownComponent;

    constructor(parent: HTMLElement,
                registerService: IRegisterService) {
        super(ComponentType.editor, parent, registerService);
    }

    protected override _createContainer(): void {
        this.parent.appendChild(this.container);
        // customize...
        this._createContentArea();
    }

    protected override _createContentArea(): void {
        this._createTitleBar();
        this._createMarkdown();
    }

    protected override _registerListeners(): void {
        
        this.markdownComponent.registerListeners();
        this.titleBarComponent.registerListeners();

    }

    private _createTitleBar(): void {
        this.titleBarComponent = new TitleBarComponent(this.container, this);
        this.titleBarComponent.create();
    }

    private _createMarkdown(): void {
        const markdownView = document.createElement('div');
        markdownView.id = 'markdown-view';

        this.markdownComponent = new MarkdownComponent(markdownView, this);
        this.markdownComponent.create();

        this.container.appendChild(markdownView);
    }

}