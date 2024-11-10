import "src/editor/contrib/blockHandleExtension/blockHandleExtension.scss";
import { Icons } from "src/base/browser/icon/icons";
import { EditorExtension, IEditorExtension } from "src/editor/common/editorExtension";
import { EditorExtensionIDs } from "src/editor/contrib/builtInExtensionList";
import { IEditorWidget } from "src/editor/editorWidget";
import { IEditorMouseEvent } from "src/editor/view/proseEventBroadcaster";
import { IWidgetBar, WidgetBar } from "src/base/browser/secondary/widgetBar/widgetBar";
import { BlockHandleButton } from "src/editor/contrib/blockHandleExtension/blockHandleButton";
import { Orientation } from "src/base/browser/basic/dom";
import { requestAtNextAnimationFrame } from "src/base/browser/basic/animation";
import { Event } from "src/base/common/event";

/**
 * An interface only for {@link EditorBlockHandleExtension}.
 */
export interface IEditorBlockHandleExtension extends IEditorExtension {

    readonly id: EditorExtensionIDs.BlockHandle;
}

export class EditorBlockHandleExtension extends EditorExtension implements IEditorBlockHandleExtension {

    // [field]

    public readonly id = EditorExtensionIDs.BlockHandle;

    private _currPosition?: number;
    private readonly _widget: IWidgetBar<BlockHandleButton>;

    // [constructor]

    constructor(editorWidget: IEditorWidget) {
        super(editorWidget);
        this._widget = this.__initWidget();

        // render
        this.__register(this.onMouseMove(e => {
            if (!e.target) {
                return;
            }

            if (this._currPosition === e.target.resolvedPosition) {
                return;
            }
            
            // // not the top-level node, we ignore it.
            const pos = e.view.state.doc.resolve(e.target.resolvedPosition);
            if (pos.depth !== 0) {
                return;
            }

            this.__unrenderWidget();
            this.__renderWidget(editorWidget.view.editor.overlayContainer, e.target);
        }));

        // unrender
        this.__register(Event.any([this.onMouseLeave, this.onTextInput])(() => {
            this.__unrenderWidget();
        }));
    }

    // [private methods]

    private __renderWidget(container: HTMLElement, target: NonNullable<IEditorMouseEvent['target']>): void {
        this._currPosition = target.resolvedPosition;

        // render under the editor overlay
        this._widget.container.setLeft(target.nodeElement.offsetLeft - 55);
        this._widget.container.setTop(target.nodeElement.offsetTop);
        this._widget.render(container);

        // fade-out effect
        this._widget.container.setOpacity(0);
        requestAtNextAnimationFrame(() => {
            this._widget?.container.setOpacity(1);
        });
    }

    private __unrenderWidget(): void {
        this._widget.unrender();
        this._currPosition = undefined;
    }

    private __initWidget(): IWidgetBar<BlockHandleButton> {
        const widget = new WidgetBar<BlockHandleButton>('block-handle-widget', {
            orientation: Orientation.Horizontal,
        });
        
        const buttonsOptions = [
            { id: 'add-new-block', icon: Icons.AddNew, classes: ['add-new-block'] },
            { id: 'drag-handle', icon: Icons.Menu, classes: ['drag-handle'] },
        ];

        for (const { id, icon, classes } of buttonsOptions) {
            const button = new BlockHandleButton({ id: id, icon: icon, classes: [...classes] });

            widget.addItem({
                id: id,
                data: button,
                dispose: button.dispose.bind(button),
            });
        }

        return widget;
    }
}