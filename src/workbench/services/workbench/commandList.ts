import { URI } from "src/base/common/files/uri";
import { FileItem } from "src/workbench/services/fileTree/fileItem";

/**
 * {@link AllCommands}
 * {@link AllCommandsDescriptions}
 * {@link AllCommandsArgumentsTypes}
 * {@link AllCommandsReturnTypes}
 */

/**
 * @description Represents a set of predefined ID that can be executed by the 
 * {@link CommandService}.
 * 
 * @note Those commands are ensured DEFINED in the program. Safely to call these
 *       commands through {@link CommandService}.
 * @note When you are modifying commands to this enumeration, MAKE SURE:
 *  1. You actually registered this command into the {@link CommandRegistrant}.
 *  2. You also update the following entries:
 *      - {@link AllCommandsDescriptions},
 *      - {@link AllCommandsArgumentsTypes} and
 *      - {@link AllCommandsReturnTypes}.
 * 
 * @note This enumeration ensures type safety by allowing only valid IDs for
 *       `executeCommand`.
 * 
 * @example
 * ```ts
 * // Example of executing a reload window command
 * commandService.executeCommand(AllCommands.reloadWindow);
 * ```
 */
export const enum AllCommands {
    
    // [TitleBar - File]

    openFolderDialog = 'openFolderDialog',

    // [workbench]

    alertError       = 'alertError',
    toggleDevTool    = 'toggle-develop-tool',
    toggleInspector  = 'toggle-inspector',
    reloadWindow     = 'reload-window',
    closeApplication = 'close-application',
    
    zoomIn           = 'zoom-in',
    zoomOut          = 'zoom-out',
    zoomSet          = 'zoom-set',

    // [FileTree]

    fileTreeNewFile    = 'fileTreeNewFile', // TODO
    fileTreeNewFolder  = 'fileTreeNewFolder', // TODO
    fileTreeCut        = 'fileTreeCut',
    fileTreeCopy       = 'fileTreeCopy',
    fileTreePaste      = 'fileTreePaste',
    fileTreeMove       = 'fileTreeMove', // TODO
    fileTreeDelete     = 'fileTreeDelete', // TODO
    
    fileTreeRevealInOS         = 'fileTreeRevealInOS',
    fileTreeCopyPath           = 'fileTreeCopyPath',
    fileTreeCopyRelativePath   = 'fileTreeCopyRelativePath',
    fileTreeCloseCurrentFolder = 'fileTreeCloseCurrentFolder',
    fileTreeOpenFolder         = 'fileTreeOpenFolder',
    fileTreeClearRecentOpened  = 'fileTreeClearRecentOpened'

    // [Test Commands]
}

/**
 * @description Provides descriptions for each command defined in {@link AllCommands}. 
 * These descriptions can be used for UI tooltips, logs, or any other feature 
 * that requires a human-readable explanation.
 */
export const AllCommandsDescriptions: { [key in AllCommands]: string } = {

    [AllCommands.openFolderDialog]: 'Select a folder in a dialog and open in the file tree.',

    [AllCommands.alertError]:       'Displays error messages in a popup notification.',
    [AllCommands.toggleDevTool]:    'Toggle the developer tool of the whole application.',
    [AllCommands.toggleInspector]:  'Toggle the inspector window of the whole application.',
    [AllCommands.reloadWindow]:     'Reload the browser entirely.',
    [AllCommands.closeApplication]: 'Close the current window.',
    
    [AllCommands.zoomIn]:           'Zoom in the entire program to the next level.',
    [AllCommands.zoomOut]:          'Zoom out the entire program to the next level.',
    [AllCommands.zoomSet]:          'Set the zoom level to the given number. In the range of -8 to 8. 0 means default.',

    [AllCommands.fileTreeNewFile]:    'Create a new file in the file tree.',
    [AllCommands.fileTreeNewFolder]:  'Create a new folder in the file tree.',
    [AllCommands.fileTreeCut]:        'Sets selected files in the file tree as ready to be cut.',
    [AllCommands.fileTreeCopy]:       'Sets selected files in the file tree as ready to be copied.',
    [AllCommands.fileTreePaste]:      'Paste the targets from the clipboard to the file tree.',
    [AllCommands.fileTreeMove]:       'Moves the targets from the clipboard to the file tree.',
    [AllCommands.fileTreeDelete]:     'Delete the targets in the file tree.',
    
    [AllCommands.fileTreeRevealInOS]:         'Reveal the target in the native file explorer.',
    [AllCommands.fileTreeCopyPath]:           'Copy path of active file path.',
    [AllCommands.fileTreeCopyRelativePath]:   'Copy relative path of active file path.',
    [AllCommands.fileTreeCloseCurrentFolder]: 'Close current file tree folder.',
    [AllCommands.fileTreeOpenFolder]:         'Open a new directory for file tree.',
    [AllCommands.fileTreeClearRecentOpened]:  'Clear recent opened file and folder paths.',
};

/**
 * @description Maps each command defined in {@link AllCommands} to its 
 * respective argument types. 
 * 
 * @note This type mapping ensures that each command is called with the correct 
 * set of arguments, providing compile-time safety and clarity on what arguments 
 * are expected for each command.
 * 
 * @example
 * ```ts
 * // No arguments are needed for these commands, so an empty array is used.
 * const argsForToggleDevTool: AllCommandsArgumentsTypes[AllCommands.toggleDevTool] = [];
 * commandService.executeCommand(AllCommands.toggleDevTool, ...argsForToggleDevTool);
 * ```
 */
export type AllCommandsArgumentsTypes = {
    
    [AllCommands.openFolderDialog]: [];

    [AllCommands.alertError]      : [reporter: string, error: any];
    [AllCommands.toggleDevTool]   : [];
    [AllCommands.toggleInspector] : [];
    [AllCommands.reloadWindow]    : [];
    [AllCommands.closeApplication]: [];
    
    [AllCommands.zoomIn]:  [];
    [AllCommands.zoomOut]: [];
    [AllCommands.zoomSet]: [level?: number];
    
    [AllCommands.fileTreeNewFile]   : [];
    [AllCommands.fileTreeNewFolder] : [];
    [AllCommands.fileTreeCut]       : [];
    [AllCommands.fileTreeCopy]      : [];
    [AllCommands.fileTreePaste]     : [destination: FileItem, destinationIdx?: number, resources?: URI[] | FileItem[]];
    [AllCommands.fileTreeMove]      : [];
    [AllCommands.fileTreeDelete]    : [];

    [AllCommands.fileTreeRevealInOS]        : [target: URI | string];
    [AllCommands.fileTreeCopyPath]          : [target: URI | string];
    [AllCommands.fileTreeCopyRelativePath]  : [target: URI | string];
    [AllCommands.fileTreeCloseCurrentFolder]: [];
    [AllCommands.fileTreeOpenFolder]        : [target: URI];
    [AllCommands.fileTreeClearRecentOpened] : [];

    [key: string]: any[];
};

/**
 * @description Defines the return types for each command in {@link AllCommands}. 
 * @note This provides type safety for the outcomes of command executions. 
 *
 * @example
 * ```ts
 * async function toggleDevTools() {
 *   await commandService.executeCommand(AllCommands.toggleDevTool);
 *   // Since the return type is void, there's no value to work with after execution
 * }
 * ```
 */
export type AllCommandsReturnTypes = {

    [AllCommands.openFolderDialog]: void;

    [AllCommands.alertError]      : void;
    [AllCommands.toggleDevTool]   : void;
    [AllCommands.toggleInspector] : void;
    [AllCommands.reloadWindow]    : void;
    [AllCommands.closeApplication]: void;

    [AllCommands.zoomIn]:  void;
    [AllCommands.zoomOut]: void;
    [AllCommands.zoomSet]: void;

    [AllCommands.fileTreeNewFile]   : void;
    [AllCommands.fileTreeNewFolder] : void;
    [AllCommands.fileTreeCut]       : void;
    [AllCommands.fileTreeCopy]      : void;
    [AllCommands.fileTreePaste]     : void;
    [AllCommands.fileTreeMove]      : void;
    [AllCommands.fileTreeDelete]    : void;

    [AllCommands.fileTreeRevealInOS]        : void;
    [AllCommands.fileTreeCopyPath]          : void;
    [AllCommands.fileTreeCopyRelativePath]  : void;
    [AllCommands.fileTreeCloseCurrentFolder]: void;
    [AllCommands.fileTreeOpenFolder]        : void;
    [AllCommands.fileTreeClearRecentOpened] : void;

    [key: string]: any | Promise<any>;
};