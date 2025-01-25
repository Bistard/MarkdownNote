import { IDisposable, Disposable } from 'src/base/common/dispose';
import { Button } from 'src/base/browser/basic/button/button';
import { Icons } from 'src/base/browser/icon/icons';
import { isDefined, isFunction } from 'src/base/common/utilities/type';
import { IUnbufferedScheduler, UnbufferedScheduler } from 'src/base/common/utilities/async';
import { Time } from 'src/base/common/date';
import { EventType, addDisposableListener } from 'src/base/browser/basic/dom';
import { Emitter, Register } from 'src/base/common/event';
import { NotificationTypes, INotificationOptions, INotificationAction } from 'src/workbench/services/notification/notificationService';

/**
 * An interface only for {@link NotificationInstance}.
 */
export interface INotificationInstance extends IDisposable {
    readonly element: HTMLElement;
    readonly type: NotificationTypes;
    readonly message: string;
    readonly subMessage?: string;
    readonly onClose: Register<void>;
}

/**
 * @class Handles rendering related operations for a notification element.
 */
export class NotificationInstance extends Disposable implements INotificationInstance {

    // [event]

    private readonly _onClose = this.__register(new Emitter<void>());
    public readonly onClose = this._onClose.registerListener;

    // [fields]

    public readonly element: HTMLElement;
    public readonly type: NotificationTypes;
    public readonly message: string;
    public readonly subMessage?: string;
    
    private _scheduler?: IUnbufferedScheduler<void>;

    // [constructor]

    constructor(private opts: INotificationOptions) {
        super();
        this.type = opts.type;
        this.message = opts.message;
        this.subMessage = opts.subMessage;
        this.element = document.createElement('div');
        this.element.className = `notification ${opts.type}`;
    }

    // [public methods]

    public render(): HTMLElement {
        this.__renderContent();
        this.__renderCloseButton();
        this.__setupHoverEvents();

        if (this.type === NotificationTypes.Info) {
            this.__startAutoCloseScheduler();
        }

        return this.element;
    }

    public override dispose(): void {
        super.dispose();
        this.element.remove();
        this._scheduler?.dispose();
    }

    // [private methods]

    private __startAutoCloseScheduler(): void {
        this._scheduler = new UnbufferedScheduler<void>(
            Time.sec(10),
            () => this.__closeNotification(true)
        );
        this._scheduler.schedule();
    }

    private __renderContent(): void {
        const content = document.createElement('div');
        content.className = 'notification-content';

        const iconWrapper = document.createElement('div');
        iconWrapper.className = 'notification-icon-wrapper';

        const iconButton = this.__createNotificationIcon();
        iconWrapper.appendChild(iconButton);

        const message = document.createElement('div');
        message.className = 'notification-message';
        message.textContent = this.opts.message;

        content.appendChild(message);

        if (isDefined(this.opts.subMessage)) {
            const subMessageActionsContainer = document.createElement('div');
            subMessageActionsContainer.className = 'submessage-actions-container';

            const subMessage = document.createElement('span');
            subMessage.className = 'notification-submessage';
            subMessage.textContent = this.opts.subMessage;
            subMessageActionsContainer.appendChild(subMessage);

            if (this.opts.actions && this.opts.actions.length) {
                this.__renderActionButtons(this.opts.actions, subMessageActionsContainer, true);
            }
            content.appendChild(subMessageActionsContainer);
        } 
        else if (this.opts.actions && this.opts.actions.length) {
            this.__renderActionButtons(this.opts.actions, content, false);
        }
        
        this.element.appendChild(iconWrapper);
        this.element.appendChild(content);
    }

    private __renderActionButtons(actions: INotificationAction[], container: HTMLElement, hasSubMessage: boolean): void {
        if (!actions || actions.length === 0) {
            return;
        }

        const actionsContainer = document.createElement('div');
        actionsContainer.className = 'notification-custom-actions';
        actionsContainer.classList.add(
            hasSubMessage ? 'submessage-actions' : 'no-submessage-actions'
        );

        // Render up to 3 actions
        actions.slice(0, 3).forEach(actionOpts => {
            const actionButton = this.__register(new Button({
                id: actionOpts.label,
                label: actionOpts.label,
                classes: ['action-button'],
            }));

            // click callback
            const fn = isFunction(actionOpts.run) 
                ? actionOpts.run
                : () => this.dispose();
            this.__register(actionButton.onDidClick(() => fn()));

            const buttonWrapper = document.createElement('div');
            buttonWrapper.className = 'action-button-wrapper';

            actionButton.render(buttonWrapper);
            actionsContainer.appendChild(buttonWrapper);
        });

        container.appendChild(actionsContainer);
    }

    private __renderCloseButton(): void {
        const closeButtonContainer = document.createElement('div');
        closeButtonContainer.className = __getIconClassByType(this.opts.type);

        const closeButton = this.__register(new Button({
            id: 'close',
            icon: Icons.Close,
            classes: ['close-button']
        }));
        this.__register(closeButton.onDidClick(() => {
            this.__closeNotification(false);
        }));

        closeButton.render(closeButtonContainer);
        this.element.appendChild(closeButtonContainer);
    }

    private __createNotificationIcon(): HTMLElement {
        const iconElement = document.createElement('span');
        iconElement.className = 'notification-icon';

        const iconClass = __getIconClassByType(this.opts.type);
        const iconButton = this.__register(new Button({
            id: this.opts.type,
            icon: iconClass,
            classes: [iconClass]
        }));
        iconButton.render(iconElement);

        return iconElement;
    }

    private __closeNotification(fadeOut: boolean): void {
        if (!fadeOut) {
            this.dispose();
            return;
        }
        
        this.element.classList.add('fade-out');
        this.element.style.opacity = '0';
        this.element.style.transition = 'opacity 0.5s';

        this.__register(addDisposableListener(this.element, EventType.transitionend, () => {
            this._onClose.fire();
            this.dispose();
        }));
    }

    private __setupHoverEvents(): void {
        this.__register(addDisposableListener(this.element, EventType.mouseenter, () => {
            this._scheduler?.cancel();
        }));

        this.__register(addDisposableListener(this.element, EventType.mouseleave, () => {
            this._scheduler?.schedule();
        }));
    }
}

function __getIconClassByType(type: NotificationTypes): Icons {
    switch (type) {
        case NotificationTypes.Info:
            return Icons.NotificationInfo;
        case NotificationTypes.Warning:
            return Icons.NotificationWarn;
        case NotificationTypes.Error:
            return Icons.NotificationError;
        default:
            return Icons.NotificationInfo;
    }
}