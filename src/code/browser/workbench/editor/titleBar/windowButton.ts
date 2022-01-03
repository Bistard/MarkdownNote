import { Button, IButtonOptions } from "src/base/browser/basic/button/button"
import { getSvgPathByName, SvgType } from "src/base/common/string";
import { ipcRendererSend } from "src/base/electron/register";

export interface IWindowButtonOptions extends IButtonOptions {
    ipcMessage: string
}

export class WindowButton extends Button {

    private _ipcMessage: string;

    constructor(opts: IWindowButtonOptions) {
        super(opts);

        this._ipcMessage = opts.ipcMessage;
    }

    /**
     * @description Sets up all the CSS attributes and icon to this action button.
     * @param src The icon name of the icon.
     */
     public override render(container: HTMLElement): void {
        super.render(container);

        if (this._element === undefined) {
            return;
        }

        // add onClick event listener
        this.onClick(this._element, (event: any) => {
            if (this.enabled === false) {
                return;
            }

            // send message to the main process
            ipcRendererSend(this._ipcMessage);
        });

        this.applyStyle();
    }

    public override applyStyle(): void {
        
        if (this._element === undefined || this.opts === undefined) {
            return;
        }

        // create a image element
        this._imgElement = document.createElement('img');
        this._imgElement.src = getSvgPathByName(SvgType.base, this.opts.src);
        this._element.appendChild(this._imgElement);

        // set element classes
        this._element.classList.add(...['toggleBtn']);
        if (this.opts.classes) {
            this._element.classList.add(...this.opts.classes);
        }

        // set image element classes
        this._imgElement.classList.add(...['vertical-center']);
    }

}