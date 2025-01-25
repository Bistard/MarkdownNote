import { ClipboardType, IClipboardService } from "src/platform/clipboard/common/clipboard";
import { Command } from "src/platform/command/common/command";
import { AllCommands } from "src/workbench/services/workbench/commandList";
import { IServiceProvider } from "src/platform/instantiation/common/instantiation";
import { IFileTreeMetadataService, IFileTreeService } from "src/workbench/services/fileTree/treeService";
import { WorkbenchContextKey } from "src/workbench/services/workbench/workbenchContextKeys";
import { URI } from "src/base/common/files/uri";
import { FileItem } from "src/workbench/services/fileTree/fileItem";
import { IContextService } from "src/platform/context/common/contextService";
import { NotificationTypes } from "src/workbench/services/notification/notificationService";
import { IFileService } from "src/platform/files/common/fileService";
import { FileOperationError, FileOperationErrorType, FileType } from "src/base/common/files/file";
import * as path from "src/base/common/files/path";
import { ICommandService } from "src/platform/command/common/commandService";
import { Arrays } from "src/base/common/utilities/array";
import { IBatchResult, IChange, createBatchResult } from "src/base/common/undoRedo";
import { noop } from "src/base/common/performance";
import { assert, assertArray, assertDefault, check, errorToMessage } from "src/base/common/utilities/panic";
import { ResourceMap } from "src/base/common/structures/map";
import { OrderChangeType } from "src/workbench/services/fileTree/fileTreeMetadataController";
import { FileSortType } from "src/workbench/services/fileTree/fileTreeSorter";
import { isNonNullable } from "src/base/common/utilities/type";
import { IConfigurationService } from "src/platform/configuration/common/configuration";
import { WorkbenchConfiguration } from "src/workbench/services/workbench/configuration.register";
import { INotificationService } from "src/workbench/services/notification/notification";

/**
 * @namespace FileCommands Contains a list of useful {@link Command}s that will
 * be registered into the command service.
 */
export namespace FileCommands {
    
    export class FileCut extends Command {

        constructor() {
            super({
                id: AllCommands.fileTreeCut,
                when: WorkbenchContextKey.focusedFileTree,
            });
        }
    
        public override run(provider: IServiceProvider): boolean | Promise<boolean> {
            return __handleCutOrCopy(provider, 'cut');
        }
    }

    export class FileCopy extends Command {
    
        constructor() {
            super({
                id: AllCommands.fileTreeCopy,
                when: WorkbenchContextKey.focusedFileTree,
            });
        }
    
        public override run(provider: IServiceProvider): boolean | Promise<boolean> {
            return __handleCutOrCopy(provider, 'copy');
        }
    }

    function __handleCutOrCopy(provider: IServiceProvider, type: 'cut' | 'copy'): boolean {
        const service = provider.getOrCreateService(IFileTreeService);
        const clipboard = provider.getOrCreateService(IClipboardService);
    
        const selections = service.getSelections();
        if (selections.length === 0) {
            return false;
        }
    
        if (type === 'copy') {
            service.highlightSelectionAsCopy(selections);
        } else {
            service.highlightSelectionAsCut(selections);
        }
    
        const resources = selections.map(item => item.uri);
        clipboard.write(ClipboardType.Resources, resources);
    
        return true;
    }
    
    export class FilePaste extends Command {
    
        private fileTreeService!: IFileTreeService;
        private fileTreeMetadataService!: IFileTreeMetadataService;
        private clipboardService!: IClipboardService;
        private fileService!: IFileService;
        private notificationService!: INotificationService;
        private commandService!: ICommandService;
        private configurationService!: IConfigurationService;

        constructor() {
            super({
                id: AllCommands.fileTreePaste,
                when: WorkbenchContextKey.focusedFileTree,
            });
        }
    
        public override async run(provider: IServiceProvider, destination: FileItem, destinationIdx?: number, resources?: URI[] | FileItem[]): Promise<boolean> {
            this.fileTreeService         = provider.getOrCreateService(IFileTreeService);
            this.clipboardService        = provider.getOrCreateService(IClipboardService);
            const contextService         = provider.getOrCreateService(IContextService);
            this.notificationService     = provider.getOrCreateService(INotificationService);
            this.fileService             = provider.getOrCreateService(IFileService);
            this.commandService          = provider.getOrCreateService(ICommandService);
            this.fileTreeMetadataService = provider.getOrCreateService(IFileTreeMetadataService);
            this.configurationService    = provider.getOrCreateService(IConfigurationService);

            const toPaste = await this.__getResourcesToPaste(resources);
            const isCut   = assert(contextService.getContextValue<boolean>(WorkbenchContextKey.fileTreeOnCutKey));
            const isNormalPaste = this.fileTreeService.getFileSortingType() !== FileSortType.Custom;

            // nothing to paste, nothing happens.
            if (toPaste.length === 0) {
                return false;
            }
            
            // paste (normal)
            if (isNormalPaste) {
                const toPasteURI = Arrays.isType<FileItem>(toPaste, element => URI.isURI(element)) 
                        ? toPaste.map(item => item.uri)
                        : toPaste;
                return await this.__pasteNormal(toPasteURI, destination, isCut);
            } 
            
            /**
             * // paste (custom sorting)
             * 
             * On detecting an insertion, the operation must be conducted from 
             * the UI perspective. Therefore must make sure the `toPaste` is an
             * array of `FileItem`.
             */
            const toPasteItems = assertArray<FileItem>(toPaste, arr => Arrays.isType(arr, element => !URI.isURI(element)));
            await this.__pasteInsert(toPasteItems, destination, isCut, destinationIdx);
            
            return true;
        }

        // [private helper methods]

        private async __getResourcesToPaste(resources?: URI[] | FileItem[]): Promise<URI[] | FileItem[]> {
            
            // paste the provided resources for higher priority
            let toPaste = resources ?? [];

            /**
             * If no provided resources, fallback to read the sources from the
             * clipboard.
             */
            if (toPaste.length === 0) {
                toPaste = await this.clipboardService.read(ClipboardType.Resources);
            }

            // check parent-child relationship
            if (Arrays.isType<URI>(toPaste, element => URI.isURI(element))) {
                return URI.distinctParents(toPaste);
            } else {
                return URI.distinctParentsByUri(toPaste, item => item.uri);
            }
        }

        private async __pasteNormal(toPaste: URI[], destination: FileItem, isCut: boolean): Promise<boolean> {
            if (destination.isFile()) {
                return false;
            }
            await this.__doPasteNormal(toPaste, destination, isCut);
            this.__clearFileTreeTraits();
            return true;
        }

        private async __doPasteNormal(toPaste: URI[], destination: FileItem, isCut: boolean): Promise<IBatchResult<IChange<URI>, FileOperationError>> {
            const operation = isCut ? this.__doMoveLot : this.__doCopyLot;
            const batch = await operation.call(this, toPaste, destination);
            
            if (batch.failed.length) {
                this.__onResourceBatchError(batch, isCut, destination.uri);
            }

            return batch;
        }

        private async __pasteInsert(toInsert: FileItem[], destination: FileItem, isCut: boolean, destinationIdx?: number): Promise<void> {
            check(destination.isDirectory());
            check(!this.fileTreeService.isCollapsed(destination));
            
            // This also check parent-child relationship.
            const dragItems = URI.distinctParentsByUri(toInsert, item => item.uri);

            /**
             * Indicate if any file/dir are actually pasted to the destination
             * in the file system.
             */
            let anyPasted = false;
            this.fileTreeService.freeze();

            /**
             * We are pasting resources grouped by the same parent at the same 
             * time. This reduces the disk reading when updating custom sorting 
             * metadata.
             */
            const groups = Arrays.group(dragItems, item => item.parent);
            for (const group of groups.values()) {
                const pasted = await this.__doPasteInsert(group, destination, isCut, destinationIdx);
                if (pasted) {
                    anyPasted = true;
                }
            }

            // after pasting, clear the traits in the view perspective.
            this.__clearFileTreeTraits();
            this.fileTreeService.unfreeze();

            /**
             * Since no file/dir is actually pasted, thus there will not trigger
             * the 'onDidResourceChange' event in the file system to update the
             * latest sorting order. 
             * 
             * We need to manually refresh here.
             */
            if (!anyPasted) {
                await this.fileTreeService.refresh();
            }
        }

        private async __doPasteInsert(toPaste: FileItem[], destination: FileItem, isCut: boolean, destinationIdx?: number): Promise<boolean> {
            const toPasteParent = assert(toPaste[0]!.parent);
            const insertAtSameParent = URI.equals(toPasteParent.uri, destination.uri);

            // actual paste operation
            const batch = (insertAtSameParent && isCut)
                ? createBatchResult({ passed: toPaste.map(item => ({ old: item.uri, new: item.uri })) })
                : await this.__doPasteNormal(toPaste.map(item => item.uri), destination, isCut);
            
            // error handling to those who fails
            if (batch.failed.length) {
                this.__onResourceBatchError(batch, isCut, destination.uri);
            }

            // no passed items, do nothing for metadata update.
            if (batch.passed.length === 0) {
                return false;
            }

            const details = this.__extractBatchDetails(batch, toPaste);

            // update metadata to those who successes
            if (insertAtSameParent) {
                await this.__updateMetadataAtSameParent(isCut, details.passedItems, details.oldParentItem, details.passedNewUri, destinationIdx);
            } else {
                await this.__updateMetadataAtDiffParent(isCut, details.passedItems, details.oldParentItem, destinationIdx ?? 0, destination, details.passedOldDirUri, details.passedNewDirUri);
            }

            // determine if any file/dir is actually pasted in the file system
            const pasted = !insertAtSameParent;
            return pasted;
        }

        private __extractBatchDetails(batch: IBatchResult<IChange<URI>>, toPaste: FileItem[]) {
            const passedOldUriMap = new ResourceMap<URI>();
            for (const passed of batch.passed) {
                passedOldUriMap.set(passed.old, passed.new);
            }
        
            /**
             * Update metadata only for successfully processed resources. 
             *  - e.g, if an operation involving 10 files where 7 succeed and 3 
             *    fail, metadata will only be updated for the 7 successful files, 
             *    leaving the others unchanged.
             */
            const passedItems: FileItem[] = [];
            const passedOldDirUri: URI[] = [];
            const passedNewDirUri: URI[] = [];
            const passedOldUri: URI[] = [];
            const passedNewUri: URI[] = [];
            const oldParentItem: FileItem = assert(toPaste[0]!.parent);
        
            for (const pastedItem of toPaste) {
                const oldUri = pastedItem.uri;
                const newUri = passedOldUriMap.get(oldUri);
                if (!newUri) {
                    continue;
                }
                passedItems.push(pastedItem);
                passedOldUri.push(oldUri);
                passedNewUri.push(newUri);
        
                if (pastedItem.isDirectory()) {
                    passedOldDirUri.push(oldUri);
                    passedNewDirUri.push(newUri);
                }
            }
        
            return {
                passedCount: passedOldUriMap.size,
                passedItems,
                passedOldDirUri,
                passedNewDirUri,
                passedOldUri,
                passedNewUri,
                oldParentItem,
            };
        }

        private async __updateMetadataAtSameParent(
            isCut: boolean, 
            passedItems: FileItem[],
            oldParentItem: FileItem,
            passedNewUri: URI[],
            destinationIdx?: number,
        ): Promise<void> {
            /**
             * Handling insertion within the same parent directory. In scenarios 
             * where the items being pasted remain within the same parent 
             * directory from which they were cut or copied, the removing and 
             * adding happens at the directory, we can integrate two operations. 
             * This operation effectively updates the sorting order of the items 
             * within the same directory.
             */
            if (isCut) {
                const resolvedIdx = assertDefault(destinationIdx, 0, 'Expecting a defined destination index when inserting at the same parent.');
                const toMoveIndice = passedItems.map(item => item.getSelfIndexInParent());
                await this.fileTreeMetadataService.updateCustomSortingMetadataLot(OrderChangeType.Move, oldParentItem.uri, null, toMoveIndice, resolvedIdx).unwrap();
            } 
            else {
                // if undefined, prefer to insert at the bottom of the last selected item.
                const resolvedIdx = isNonNullable(destinationIdx) 
                    ? destinationIdx
                    : assert(passedItems[0]).getSelfIndexInParent() + 1;
                const addIndice = Arrays.fill(resolvedIdx, passedItems.length);
                await this.fileTreeMetadataService.updateCustomSortingMetadataLot(OrderChangeType.Add, oldParentItem.uri, passedNewUri.map(uri => URI.basename(uri)), addIndice).unwrap();
            }
        }
        
        private async __updateMetadataAtDiffParent(
            isCut: boolean,
            passedItems: FileItem[],
            oldParentItem: FileItem,
            destinationIdx: number,
            destination: FileItem,
            passedOldDirUri: URI[],
            passedNewDirUri: URI[],
        ): Promise<void> {
            /**
             * Step 1: In the general cut operation, after items are moved 
             * to their new location, the metadata at the original location 
             * should be removed.
             */
            if (isCut) {
                const removeIndice: number[] = [];
                for (const item of passedItems) {
                    const idx = item.getSelfIndexInParent();
                    removeIndice.push(idx);
                }
                
                await this.fileTreeMetadataService.updateCustomSortingMetadataLot(
                    OrderChangeType.Remove, 
                    oldParentItem.uri, 
                    null,
                    removeIndice,
                ).unwrap();
            }

            /**
             * Step 2: Update the metadata at the new location with the newly 
             * pasting items.
             */
            const passedNames = passedItems.map(item => item.name);
            const addIndice = Arrays.fill(destinationIdx, passedItems.length);

            await this.fileTreeMetadataService.updateCustomSortingMetadataLot(
                OrderChangeType.Add,
                destination.uri,
                passedNames,
                addIndice
            ).unwrap();

            /**
             * Step 3: To those who passed are directory, we need to move 
             * its entire metadata to a new location.
             */
            Arrays.Async.parallelEach([passedOldDirUri, passedNewDirUri], async (oldDirUri, newDirUri) => {
                await this.fileTreeMetadataService.updateDirectoryMetadata(oldDirUri, newDirUri, isCut).unwrap();
            });
        }

        private async __doMoveLot(toPaste: URI[], destination: FileItem): Promise<IBatchResult<IChange<URI>, FileOperationError>> {
            const result: IBatchResult<IChange<URI>, FileOperationError> = {
                passed: [],
                failed: [],
                failedError: [],
            };

            /**
             * Iterate every pasting items and try to move to the destination. 
             * If any existing files or folders found at the destination, a 
             * window will pop up and ask for user permission if to overwrite.
             */
            for (const resource of toPaste) {
                const resourceName = URI.basename(resource);
                const newDestination = URI.join(destination.uri, resourceName);
                const change = { old: resource, new: newDestination };

                const valid = await this.__validateBeforeMove(newDestination);
                if (!valid) {
                    continue;
                }

                const success = await this.fileService.moveTo(resource, newDestination, false);

                // complete
                if (success.isOk()) {
                    result.passed.push(change);
                    continue;
                }
                
                // only expect `FILE_EXISTS` error
                const error = success.unwrapErr();
                if (error.code !== FileOperationErrorType.FILE_EXISTS) {
                    this.commandService.executeCommand(AllCommands.alertError, 'FilePaste', error);
                }

                /**
                 * Error happens, we mark it as not completed, let the client to
                 * handle.
                 */
                result.failed.push(change);
                result.failedError?.push(error);
            }

            return result;
        }

        private async __validateBeforeMove(destination: URI): Promise<boolean> {
            const exist = await this.fileService.exist(destination);
            if (exist.isErr()) {
                return false;
            }

            if (!exist.unwrap()) {
                return true;
            }

            const confirmed = await this.notificationService.confirm(
                `A file or folder with the name '${URI.basename(destination)}' already exists in the destination folder. Do you want to replace it?`,
                `Overwrite Warning.`
            );
            return confirmed;
        }

        private async __doCopyLot(toPaste: URI[], destination: FileItem): Promise<IBatchResult<IChange<URI>, FileOperationError>> {
            const result: IBatchResult<IChange<URI>, FileOperationError> = {
                passed: [],
                failed: [],
                failedError: [],
            };
            const incrementType = this.configurationService.get(WorkbenchConfiguration.ExplorerIncrementFileNaming, IncrementFileType.Simple);

            /**
             * Iterate every selecting items and try to copy to the destination. 
             * If a duplicate item name is encountered, append '_copy' as a 
             * postfix to the name of the copied item.
             */
            for (const resource of toPaste) {
                const baseName = URI.basename(resource);
                let newDestination = URI.join(destination.uri, baseName);
                
                // name conflict, increment the name.
                if (URI.equals(resource, newDestination)) {
                    const stat = await this.fileService.stat(resource).unwrap();
                    const incrementedName = incrementFileName(baseName, stat.type === FileType.DIRECTORY, incrementType);
                    newDestination = URI.join(destination.uri, incrementedName);
                }

                const change = { old: resource, new: newDestination };
                const copy = await this.fileService.copyTo(resource, newDestination, false);
                
                // complete
                if (copy.isOk()) {
                    result.passed.push(change);
                    continue;
                }

                /**
                 * Error happens, we mark it as not completed, let the client to
                 * handle.
                 */
                result.failed.push(change);
                result.failedError?.push(copy.unwrapErr());
            }

            return result;
        }

        private __onResourceBatchError(batch: IBatchResult<IChange<URI>>, isCut: boolean, destination: URI): void {
            Arrays.parallelEach([batch.failed, batch.failedError], (failed, error) => {
                const operation = isCut ? 'move' : 'copy';
                const targetName = URI.basename(failed.old);
                const destinName = URI.basename(destination);

                this.notificationService.notify({ 
                    type: NotificationTypes.Info,
                    message: `Cannot ${operation} ${targetName} to ${destinName}. Reason: ${errorToMessage(error)}`,
                    actions: [
                        { label: 'Ok', run: noop },

                        // FIX: parameter wrong
                        // { label: 'Retry', run: () => this.commandService.executeCommand(AllCommands.fileTreePaste, destination, [failed]) }
                    ]
                });
            });
        }

        private __clearFileTreeTraits(): void {
            this.fileTreeService.setSelections([]);
            this.fileTreeService.setFocus(null);
        }
    }
}

export const enum IncrementFileType {
    Simple = 'simple',
    Smart  = 'smart',
}

/**
 * @description Increments the version number in a file or folder name according 
 * to a specified incremental type.
 * 
 * @note This function intelligently handles different naming conventions, 
 *       including names with numerical suffixes, 'copy' notations, and 
 *       extension-preserving increments. 
 *
 * @param name The original name of the file or folder to be incremented.
 * @param isFolder Indicates whether the name represents a folder (true) or a 
 *                 file (false).
 * @param type The type of incremental to apply.
 * @returns The incremented name, preserving any file extension and adhering to 
 *          the specified incremental type.
 */
export function incrementFileName(name: string, isFolder: boolean, type: IncrementFileType): string {
    if (type === IncrementFileType.Simple) {
		let namePrefix = name;
		let extSuffix = '';
		if (!isFolder) {
			extSuffix = path.extname(name);
			namePrefix = path.basename(name, extSuffix);
		}

		// name copy 5(.txt) => name copy 6(.txt)
		// name copy(.txt) => name copy 2(.txt)
		const suffixRegex = /^(.+ copy)( \d+)?$/;
		if (suffixRegex.test(namePrefix)) {
			return namePrefix.replace(suffixRegex, (match, g1?, g2?) => {
				const number = (g2 ? parseInt(g2) : 1);
				return number === 0
					? `${g1}`
					: (number < Number.MAX_SAFE_INTEGER
						? `${g1} ${number + 1}`
						: `${g1}${g2} copy`);
			}) + extSuffix;
		}

		// name(.txt) => name copy(.txt)
		return `${namePrefix} copy${extSuffix}`;
	}

	const separators = '[\\.\\-_]';
	const maxNumber = Number.MAX_SAFE_INTEGER;

	// file.1.txt=>file.2.txt
	const suffixFileRegex = RegExp('(.*' + separators + ')(\\d+)(\\..*)$');
	if (!isFolder && name.match(suffixFileRegex)) {
		return name.replace(suffixFileRegex, (match, g1?, g2?, g3?) => {
			const number = parseInt(g2);
			return number < maxNumber
				? g1 + String(number + 1).padStart(g2.length, '0') + g3
				: `${g1}${g2}.1${g3}`;
		});
	}

	// 1.file.txt=>2.file.txt
	const prefixFileRegex = RegExp('(\\d+)(' + separators + '.*)(\\..*)$');
	if (!isFolder && name.match(prefixFileRegex)) {
		return name.replace(prefixFileRegex, (match, g1?, g2?, g3?) => {
			const number = parseInt(g1);
			return number < maxNumber
				? String(number + 1).padStart(g1.length, '0') + g2 + g3
				: `${g1}${g2}.1${g3}`;
		});
	}

	// 1.txt=>2.txt
	const prefixFileNoNameRegex = RegExp('(\\d+)(\\..*)$');
	if (!isFolder && name.match(prefixFileNoNameRegex)) {
		return name.replace(prefixFileNoNameRegex, (match, g1?, g2?) => {
			const number = parseInt(g1);
			return number < maxNumber
				? String(number + 1).padStart(g1.length, '0') + g2
				: `${g1}.1${g2}`;
		});
	}

	// file.txt=>file.1.txt
	const lastIndexOfDot = name.lastIndexOf('.');
	if (!isFolder && lastIndexOfDot >= 0) {
		return `${name.substr(0, lastIndexOfDot)}.1${name.substr(lastIndexOfDot)}`;
	}

	// 123 => 124
	const noNameNoExtensionRegex = RegExp('(\\d+)$');
	if (!isFolder && lastIndexOfDot === -1 && name.match(noNameNoExtensionRegex)) {
		return name.replace(noNameNoExtensionRegex, (match, g1?) => {
			const number = parseInt(g1);
			return number < maxNumber
				? String(number + 1).padStart(g1.length, '0')
				: `${g1}.1`;
		});
	}

	// file => file1
	// file1 => file2
	const noExtensionRegex = RegExp('(.*)(\\d*)$');
	if (!isFolder && lastIndexOfDot === -1 && name.match(noExtensionRegex)) {
		return name.replace(noExtensionRegex, (match, g1?, g2?) => {
			let number = parseInt(g2);
			if (isNaN(number)) {
				number = 0;
			}
			return number < maxNumber
				? g1 + String(number + 1).padStart(g2.length, '0')
				: `${g1}${g2}.1`;
		});
	}

	// folder.1=>folder.2
	if (isFolder && name.match(/(\d+)$/)) {
		return name.replace(/(\d+)$/, (match, ...groups) => {
			const number = parseInt(groups[0]);
			return number < maxNumber
				? String(number + 1).padStart(groups[0].length, '0')
				: `${groups[0]}.1`;
		});
	}

	// 1.folder=>2.folder
	if (isFolder && name.match(/^(\d+)/)) {
		return name.replace(/^(\d+)(.*)$/, (match, ...groups) => {
			const number = parseInt(groups[0]);
			return number < maxNumber
				? String(number + 1).padStart(groups[0].length, '0') + groups[1]
				: `${groups[0]}${groups[1]}.1`;
		});
	}

	// file/folder=>file.1/folder.1
	return `${name}.1`;
}