import { Register } from "src/base/common/event";
import { URI } from "src/base/common/files/uri";
import { ISideView } from "src/workbench/parts/sideView/sideView";

export const ExplorerViewID = 'explorer-view';

/**
 * An interface only for {@link ExplorerView}.
 */
export interface IExplorerViewService extends ISideView {

    /**
     * Determine if the explorer view is opened right now.
     */
    readonly isOpened: boolean;

    /**
     * The root directory of the current opened explorer view. `undefined` if 
     * the view is not opened yet.
     */
    readonly root: URI | undefined;

    /**
     * Fired when the directory is opened.
     */
    onDidOpen: Register<IClassicOpenEvent>;

    /**
     * Open the explorer view under the given root path.
     */
    open(root: URI): Promise<void>;

    /**
     * Close the explorer view if any path is opened.
     */
    close(): Promise<void>;
}

export interface IClassicOpenEvent {

    /**
     * The path of the current opened directory in URI form.
     */
    readonly path: URI;
}