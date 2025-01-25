import { IDisposable } from "src/base/common/dispose";
import { createService, IService } from "src/platform/instantiation/common/decorator";
import { INotificationOptions } from "src/workbench/services/notification/notificationService";

export const INotificationService = createService<INotificationService>('notification-service');

/**
 * An interface only for {@link NotificationService}.
 */
export interface INotificationService extends IDisposable, IService {
    
    /**
     * @description Displays a notification with the provided options.
     */
    notify(options: INotificationOptions): void;
    
    /**
     * @description Displays a operating system based confirmation dialog and 
     * let the user to confirm or deny.
     * @param message The main message to display.
     * @param subMessage The optional sub-message for more details.
     * @returns A promise that resolves to `true` if the user confirms, 
     *          otherwise `false`.
     */
    confirm(message: string, subMessage: string): Promise<boolean>;

    /**
     * @description A convenient way of invoking `this.notify({ type: 'error', ... })`.
     * @param error The error to display.
     */
    error(error: string | Error, options: Omit<INotificationOptions, 'type' | 'message'>): void;
}