import { AllCommands } from "src/workbench/services/workbench/commandList";
import { IHostService } from "src/platform/host/common/hostService";
import { ILifecycleService } from "src/platform/lifecycle/browser/browserLifecycleService";
import { RegistrantType, createRegister } from "src/platform/registrant/common/registrant";
import { FileCommands } from "src/workbench/services/fileTree/fileCommands";
import { Command } from "src/platform/command/common/command";
import { IServiceProvider } from "src/platform/instantiation/common/instantiation";
import { INotificationService } from "src/workbench/services/notification/notificationService";
import { errorToMessage } from "src/base/common/utilities/panic";
import { ILogService } from "src/base/common/logger";
import { IBrowserZoomService } from "src/workbench/services/zoom/zoomService";
import { URI } from "src/base/common/files/uri";
import { isString } from "src/base/common/utilities/type";
import { ClipboardType, IClipboardService } from "src/platform/clipboard/common/clipboard";
import { IFileTreeService } from "src/workbench/services/fileTree/treeService";
import { IS_WINDOWS } from "src/base/common/platform";
import { IBrowserInspectorService } from "src/platform/inspector/common/inspector";
import { INavigationViewService } from "src/workbench/parts/navigationPanel/navigationView/navigationView";
import { ExplorerViewID } from "src/workbench/contrib/explorer/explorerService";
import { ExplorerView } from "src/workbench/contrib/explorer/explorer";
import { IMainDialogService } from "src/platform/dialog/electron/mainDialogService";

export const rendererWorkbenchCommandRegister = createRegister(
    RegistrantType.Command, 
    'rendererWorkbench',
    (registrant) => {
        registrant.registerCommandBasic(
            {
                id: AllCommands.toggleDevTool,
                command: (provider) => { provider.getOrCreateService(IHostService).toggleDevTools(); },
            },
        );
        
        registrant.registerCommandBasic(
            {
                id: AllCommands.toggleInspector,
                command: (provider) => { 
                    const inspectorService = provider.getOrCreateService(IBrowserInspectorService);
                    if (inspectorService.isListening()) {
                        inspectorService.stopListenTo();
                    }
                    provider.getOrCreateService(IHostService).toggleInspectorWindow(); 
                },
            },
        );
    
        registrant.registerCommandBasic(
            {
                id: AllCommands.reloadWindow,
                command: (provider) => { provider.getOrCreateService(IHostService).reloadWebPage(); },
            },
        );
    
        registrant.registerCommandBasic(
            {
                id: AllCommands.closeApplication,
                command: (provider) => { provider.getOrCreateService(ILifecycleService).quit(); },
            },
        );

        registrant.registerCommandBasic(
            {
                id: AllCommands.zoomIn,
                command: (provider) => { provider.getOrCreateService(IBrowserZoomService).zoomIn(); },
            },
        );
        
        registrant.registerCommandBasic(
            {
                id: AllCommands.zoomOut,
                command: (provider) => { provider.getOrCreateService(IBrowserZoomService).zoomOut(); },
            },
        );
        
        registrant.registerCommandBasic(
            {
                id: AllCommands.zoomSet,
                command: (provider, level?: number) => { provider.getOrCreateService(IBrowserZoomService).setZoomLevel(level); },
            },
        );
        
        registrant.registerCommand(new AlertError());
        registrant.registerCommand(new FileCommands.FileCut());
        registrant.registerCommand(new FileCommands.FileCopy());
        registrant.registerCommand(new FileCommands.FilePaste());
        registrant.registerCommandBasic(
            {
                id: AllCommands.fileTreeRevealInOS,
                command: (provider, source: URI | string) => provider.getOrCreateService(IHostService).showItemInFolder(isString(source) ? source : URI.toFsPath(source))
            }
        );
        registrant.registerCommandBasic(
            {
                id: AllCommands.fileTreeCopyPath,
                command: (provider, source: URI | string) => {
                    const clipboardService = provider.getOrCreateService(IClipboardService);
                    clipboardService.write(ClipboardType.Text, isString(source) ? source : URI.toFsPath(source));
                }
            }
        );
        registrant.registerCommandBasic(
            {
                id: AllCommands.fileTreeCopyRelativePath,
                command: (provider, source: URI | string) => {
                    const clipboardService = provider.getOrCreateService(IClipboardService);
                    const fileTreeService = provider.getOrCreateService(IFileTreeService);
                    
                    if (!fileTreeService.root) {
                        return;
                    }

                    let relativePath = isString(source) 
                        ? URI.relative(fileTreeService.root, URI.fromFile(source))
                        : URI.relative(fileTreeService.root, source);

                    if (IS_WINDOWS) {
                        relativePath = relativePath?.replaceAll('/', '\\');
                    }

                    clipboardService.write(ClipboardType.Text, relativePath ?? 'RelativePath Error');
                }
            }
        );
        registrant.registerCommandBasic(
            {
                id: AllCommands.fileTreeCloseCurrentFolder,
                command: (provider) => {
                    const navViewService = provider.getOrCreateService(INavigationViewService);
                    const currentView = navViewService.currView();
                    if (currentView && currentView.id === ExplorerViewID) {
                        (<ExplorerView>currentView).close();
                    }
                }
            }
        );
        registrant.registerCommandBasic({
            id: AllCommands.fileTreeOpenFolder,
            command: (provider, folderPath: string) => {
                console.log("fileTreeOpenFolder invoked with folderPath:", folderPath); // Log folderPath
                if (!folderPath) {
                    console.error("Folder path is undefined or empty.");
                    return;
                }

                const navViewService = provider.getOrCreateService(INavigationViewService);
                const currentView = navViewService.currView();
                const folderURI = URI.parse(folderPath);
                (<ExplorerView>currentView).open(folderURI);
            }
        });
    },
);

class AlertError extends Command {

    constructor() {
        super({
            id: AllCommands.alertError,
            when: null,
        });
    }

    public override run(provider: IServiceProvider, reporter: string, error: any): boolean {
        const notificationService = provider.getOrCreateService(INotificationService);
        const logService = provider.getOrCreateService(ILogService);

        let message: string;
        if (typeof error === 'string') {
            message = error;
        } else {
            message = errorToMessage(error.message ?? error, false);
        }

        logService.error(reporter, message, error);
        notificationService.error(message, { actions: [{ label: 'Close', run: 'noop' }] });

        return true;
    }
}