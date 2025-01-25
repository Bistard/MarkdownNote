import 'src/workbench/services/notification/notification.scss';
import { Disposable, disposeAll } from "src/base/common/dispose";
import { NotificationInstance } from 'src/workbench/services/notification/notificationInstance';
import { Arrays } from 'src/base/common/utilities/array';
import { errorToMessage } from 'src/base/common/utilities/panic';
import { Event } from 'src/base/common/event';
import { Callable } from 'src/base/common/utilities/type';
import { INotificationService } from 'src/workbench/services/notification/notification';

export const enum NotificationTypes {
    Info = 'info',
    Warning = 'warning',
    Error = 'error'
}

/**
 * An option to construct a {@link NotificationInstance}.
 */
export interface INotificationOptions {

    /**
     * Describe the type of the notification.
     */
    readonly type: NotificationTypes;

    /**
     * The main message.
     */
    readonly message: string;

    /**
     * Optional. The sub message if needed.
     */
    readonly subMessage?: string;

    /**
     * Optional. Describe a list of action buttons for the notification.
     */
    readonly actions?: INotificationAction[];
}

/**
 * An interface that describe every action button in a {@link NotificationInstance}.
 */
export interface INotificationAction {
    
    /**
     * The name of the action button.
     */
    readonly label: string;

    /**
     * Either:
     *      1. A callback to execute or
     *      2. provide an 'noop' marker to tell the button do nothing and close
     *         the {@link NotificationInstance}.
     */
    readonly run: Callable<[], void> | 'noop';
}

/**
 * @class Provides notification services, such as displaying error messages,
 * notifications, and confirmation dialogs.
 */
export class NotificationService extends Disposable implements INotificationService {

    declare _serviceMarker: undefined;

    // [fields]

    private readonly _container: HTMLElement;
    private readonly _notifications: NotificationInstance[];

    // [constructor]

    constructor(parent: HTMLElement = document.body) {
        super();
        this._notifications = [];
        this._container = document.createElement('div');
        this._container.className = 'notification-container';
        parent.appendChild(this._container);
    }

    // [public methods]

    public error(error: string | Error, options: Omit<INotificationOptions, 'type' | 'message'>): void {
        this.notify({
            type: NotificationTypes.Error,
            message: errorToMessage(error),
            ...options
        });
    }

    public confirm(message: string, subMessage: string): Promise<boolean> {
        return new Promise<boolean>((resolve) => {
            const result = window.confirm(`${message}\n\n${subMessage}`);
            resolve(result);
        });
    }

    public notify(opts: INotificationOptions): void {
        const instance = new NotificationInstance(opts);
        this._notifications.push(instance);

        const element = instance.render();
        this._container.appendChild(element);

        Event.onceSafe(instance.onClose)(() => {
            Arrays.remove(this._notifications, instance);
        });
    }

    public override dispose(): void {
        super.dispose();
        disposeAll(this._notifications);
    }
}
