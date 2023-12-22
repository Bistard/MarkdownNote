import { ITreeNode } from "src/base/browser/secondary/tree/tree";
import { ITreeListRenderer } from "src/base/browser/secondary/tree/treeListRenderer";
import { IListViewMetadata, RendererType } from "src/base/browser/secondary/listView/listRenderer";
import { FuzzyScore } from "src/base/common/fuzzy";
import { FileItem } from "src/workbench/services/fileTree/fileItem";
import { Icons } from "src/base/browser/icon/icons";
import { getIconClass } from "src/base/browser/icon/iconRegistry";
import { IListItemProvider } from "src/base/browser/secondary/listView/listItemProvider";

/**
 * The type of metadata returned by {@link FileItemRenderer.render()}.
 */
export interface IFileItemMetadata extends IListViewMetadata {
    // nothing here for now
}

/**
 * @class The type of renderer used for {@link ClassicTreeService}.
 */
export class FileItemRenderer implements ITreeListRenderer<FileItem, FuzzyScore, IFileItemMetadata> {

    public readonly type = RendererType.Explorer;

    constructor() {

    }

    public render(element: HTMLElement): IFileItemMetadata {
        const text = document.createElement('span');
        text.className = 'explorer-item';
        text.style.lineHeight = `${FileItemProvider.Size}px`;

        element.appendChild(text);

        return {
            container: text
        };
    }

    public update(item: ITreeNode<FileItem, void>, index: number, data: IFileItemMetadata, size?: number): void {

        const text = data.container;
        text.textContent = item.data.name;

    }

    public updateIndent(item: ITreeNode<FileItem, FuzzyScore>, indentElement: HTMLElement): void {
        if (item.collapsible) {
            indentElement.classList.add(...getIconClass(Icons.CaretDown));
        } else {
            indentElement.classList.remove(...getIconClass(Icons.CaretDown));
        }
    }

    public dispose(data: IFileItemMetadata): void {
        // TODO
    }

}

/**
 * @class A {@link IListItemProvider} used for {@link FileItem}.
 */
export class FileItemProvider implements IListItemProvider<FileItem> {

    public static readonly Size = 30;

    public getSize(data: FileItem): number {
        return FileItemProvider.Size;
    }

    public getType(data: FileItem): RendererType {
        return RendererType.Explorer;
    }

}