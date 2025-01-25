import * as assert from 'assert';
import { suite, test } from 'mocha';
import { TextEditorPaneModel } from 'src/workbench/services/editorPane/editorPaneModel';
import { URI } from 'src/base/common/files/uri';
import { EditorGroupChangeType, EditorGroupModel, EditorGroupOpenPositioning, IEditorGroupChangeEvent } from 'src/workbench/parts/workspace/editorGroupModel';
import { ConfigurationModuleType, IConfigurationService } from 'src/platform/configuration/common/configuration';
import { WorkbenchConfiguration } from 'src/workbench/services/workbench/configuration.register';
import { FakeAsync } from 'test/utils/fakeAsync';
import { createIntegration } from 'test/utils/integration';
import { RegistrantType } from 'src/platform/registrant/common/registrant';

suite('EditorGroupModel Test', () => {
    
    async function initEditorGroupModel(): Promise<[EditorGroupModel, IConfigurationService]> {
        const di = await createIntegration({ 
            fileService: 'inMemory',
            registrantService: [RegistrantType.Configuration],
            configurationService: true,
        });
        
        const configurationService = di.getOrCreateService(IConfigurationService);
        await configurationService.set(WorkbenchConfiguration.EditorOpenPositioning, EditorGroupOpenPositioning.Last, { type: ConfigurationModuleType.User });
        return [
            new EditorGroupModel(configurationService),
            configurationService,
        ];
    }

    suite('Read-only APIs', () => {
        let group!: EditorGroupModel;
        let editor1!: TextEditorPaneModel;
        let editor2!: TextEditorPaneModel;
        let editor3!: TextEditorPaneModel;
    
        suiteSetup(() => FakeAsync.run(async () => {
            group = (await initEditorGroupModel())[0];
            editor1 = new TextEditorPaneModel(URI.parse('file://test1'));
            editor2 = new TextEditorPaneModel(URI.parse('file://test2'));
            editor3 = new TextEditorPaneModel(URI.parse('file://test3'));
            group.openEditor(editor1, {});
            group.openEditor(editor2, {});
            group.openEditor(editor3, {});
        }));
    
        suite('getEditors', () => {
            test('should return editors in sequential order', () => {
                const editors = group.getEditors('sequential');
                assert.strictEqual(editors.length, 3);
                assert.strictEqual(editors[0], editor1);
                assert.strictEqual(editors[1], editor2);
                assert.strictEqual(editors[2], editor3);
            });
    
            test('should return editors in MRU order', () => {
                group.openEditor(editor2, { focused: true }); // Make editor2 the most recently used
                const editors = group.getEditors('mru');
                assert.strictEqual(editors[0], editor2);
                assert.strictEqual(editors[1], editor3);
                assert.strictEqual(editors[2], editor1);
            });
        });
    
        suite('getEditorByIndex', () => {
            test('should return the editor at the specified index', () => {
                assert.strictEqual(group.getEditorByIndex(0), editor1);
                assert.strictEqual(group.getEditorByIndex(1), editor2);
                assert.strictEqual(group.getEditorByIndex(2), editor3);
            });
    
            test('should return undefined for an out-of-bounds index', () => {
                assert.strictEqual(group.getEditorByIndex(-1), undefined);
                assert.strictEqual(group.getEditorByIndex(3), undefined);
            });
        });
    
        suite('findEditor', () => {
            test('should return the editor and index if the editor exists', () => {
                const result = group.findEditor(editor2);
                assert.strictEqual(result?.model, editor2);
                assert.strictEqual(result?.index, 1);
            });
    
            test('should return undefined if the editor does not exist', () => {
                const nonExistentEditor = new TextEditorPaneModel(URI.parse('file://nonexistent'));
                const result = group.findEditor(nonExistentEditor);
                assert.strictEqual(result, undefined);
            });
        });
    
        suite('indexOf', () => {
            test('should return the index of the specified editor', () => {
                assert.strictEqual(group.indexOf(editor1), 0);
                assert.strictEqual(group.indexOf(editor2), 1);
                assert.strictEqual(group.indexOf(editor3), 2);
            });
    
            test('should return -1 if the editor does not exist', () => {
                const nonExistentEditor = new TextEditorPaneModel(URI.parse('file://nonexistent'));
                assert.strictEqual(group.indexOf(nonExistentEditor), -1);
            });
        });
    
        suite('contains', () => {
            test('should return true if the editor is in the group', () => {
                assert.strictEqual(group.contains(editor1), true);
                assert.strictEqual(group.contains(editor2), true);
                assert.strictEqual(group.contains(editor3), true);
            });
    
            test('should return false if the editor is not in the group', () => {
                const nonExistentEditor = new TextEditorPaneModel(URI.parse('file://nonexistent'));
                assert.strictEqual(group.contains(nonExistentEditor), false);
            });
        });
    
        suite('isFirst', () => {
            test('should return true for the first editor', () => {
                assert.strictEqual(group.isFirst(editor1), true);
            });
    
            test('should return false for non-first editors', () => {
                assert.strictEqual(group.isFirst(editor2), false);
                assert.strictEqual(group.isFirst(editor3), false);
            });
        });
    
        suite('isLast', () => {
            test('should return true for the last editor', () => {
                assert.strictEqual(group.isLast(editor3), true);
            });
    
            test('should return false for non-last editors', () => {
                assert.strictEqual(group.isLast(editor1), false);
                assert.strictEqual(group.isLast(editor2), false);
            });
        });
    });
    
    suite('Writable APIs', () => {
    
        suite('openEditor', () => {
            test('should add a new editor to the group', () => FakeAsync.run(async () => {
                const group = (await initEditorGroupModel())[0];
                const editor = new TextEditorPaneModel(URI.parse('file://test'));
    
                assert.strictEqual(group.size, 0);
                const result = group.openEditor(editor, {});
                assert.strictEqual(group.size, 1);
                assert.strictEqual(result.model, editor);
                assert.strictEqual(result.existed, false);
            }));
    
            test('should not duplicate an existing editor', () => FakeAsync.run(async () => {
                const group = (await initEditorGroupModel())[0];
                const editor = new TextEditorPaneModel(URI.parse('file://test'));
    
                group.openEditor(editor, {});
                const result = group.openEditor(editor, {});
                assert.strictEqual(group.size, 1);
                assert.strictEqual(result.model, editor);
                assert.strictEqual(result.existed, true);
            }));
    
            test('should move an existing editor to a new index if specified', () => FakeAsync.run(async () => {
                const group = (await initEditorGroupModel())[0];
                const editor1 = new TextEditorPaneModel(URI.parse('file://test1'));
                const editor2 = new TextEditorPaneModel(URI.parse('file://test2'));
    
                group.openEditor(editor1, {});
                group.openEditor(editor2, {});
                assert.strictEqual(group.size, 2);
    
                const result = group.openEditor(editor1, { index: 1 });
                assert.strictEqual(group.size, 2);
                assert.strictEqual(result.existed, true);
                assert.strictEqual(group.getEditorByIndex(1), editor1);
            }));
        });
    
        suite('closeEditor', () => {
            test('should remove an existing editor from the group', () => FakeAsync.run(async () => {
                const group = (await initEditorGroupModel())[0];
                const editor = new TextEditorPaneModel(URI.parse('file://test'));
    
                group.openEditor(editor, {});
                const result = group.closeEditor(editor, {})!;
    
                assert.strictEqual(group.size, 0);
                assert.strictEqual(result.model, editor);
                assert.strictEqual(result.index, 0);
            }));
    
            test('should return undefined if the editor does not exist', () => FakeAsync.run(async () => {
                const group = (await initEditorGroupModel())[0];
                const editor = new TextEditorPaneModel(URI.parse('file://test'));
    
                const result = group.closeEditor(editor, {});
                assert.strictEqual(result, undefined);
            }));
        });
    
        suite('moveEditor', () => {
            test('should move an editor to a specified index', () => FakeAsync.run(async () => {
                const group = (await initEditorGroupModel())[0];
                const editor1 = new TextEditorPaneModel(URI.parse('file://test1'));
                const editor2 = new TextEditorPaneModel(URI.parse('file://test2'));
    
                group.openEditor(editor1, {});
                group.openEditor(editor2, {});
                assert.strictEqual(group.size, 2);
    
                const result = group.moveEditor(editor1, 1);
    
                assert.ok(result);
                assert.strictEqual(result.model, editor1);
                assert.strictEqual(result.from, 0);
                assert.strictEqual(result.to, 1);
                assert.strictEqual(group.getEditorByIndex(1), editor1);
            }));
    
            test('should return undefined if the editor does not exist', () => FakeAsync.run(async () => {
                const group = (await initEditorGroupModel())[0];
                const editor = new TextEditorPaneModel(URI.parse('file://test'));
    
                const result = group.moveEditor(editor, 1);
                assert.strictEqual(result, undefined);
            }));
    
            test('should move nothing when moving to the same position', () => FakeAsync.run(async () => {
                const group = (await initEditorGroupModel())[0];
                const editor = new TextEditorPaneModel(URI.parse('file://test'));
    
                group.openEditor(editor, {});
                const result = group.moveEditor(editor, -1)!;
    
                assert.strictEqual(result, undefined);
            }));
    
            test('should clamp the target index to valid bounds', () => FakeAsync.run(async () => {
                const group = (await initEditorGroupModel())[0];
                const editor1 = new TextEditorPaneModel(URI.parse('file://test1'));
                const editor2 = new TextEditorPaneModel(URI.parse('file://test2'));
    
                group.openEditor(editor1, {});
                group.openEditor(editor2, {});
                assert.strictEqual(group.size, 2);
    
                const result = group.moveEditor(editor1, 10);
    
                assert.ok(result);
                assert.strictEqual(result.from, 0);
                assert.strictEqual(result.to, 2);
                assert.strictEqual(result.model, editor1);
            }));
        });
    });
    
    suite('Event', () => {
    
        let group: EditorGroupModel;
        let editor1: TextEditorPaneModel;
        let editor2: TextEditorPaneModel;
        let editor3: TextEditorPaneModel;
    
        setup(() => FakeAsync.run(async () => {
            group = (await initEditorGroupModel())[0];
            editor1 = new TextEditorPaneModel(URI.parse('file://test1'));
            editor2 = new TextEditorPaneModel(URI.parse('file://test2'));
            editor3 = new TextEditorPaneModel(URI.parse('file://test3'));
        }));
    
        test('should fire EDITOR_OPEN event with correct data', () => {
            let event!: IEditorGroupChangeEvent;
            group.onDidChangeModel(e => {
                if (e.type === EditorGroupChangeType.EDITOR_OPEN) {
                    event = e;
                }
            });
    
            group.openEditor(editor1, { index: 0 });
    
            assert.ok(event);
            assert.strictEqual(event?.type, EditorGroupChangeType.EDITOR_OPEN);
            assert.strictEqual(event?.model, editor1);
            assert.strictEqual(event?.modelIndex, 0);
        });
    
        test('should fire EDITOR_CLOSE event with correct data', () => {
            group.openEditor(editor1, {});
            let event!: IEditorGroupChangeEvent;
            group.onDidChangeModel(e => {
                event = e;
            });
    
            group.closeEditor(editor1, {});
    
            assert.ok(event);
            assert.strictEqual(event?.type, EditorGroupChangeType.EDITOR_CLOSE);
            assert.strictEqual(event?.model, editor1);
            assert.strictEqual(event?.modelIndex, 0);
        });
    
        test('should fire EDITOR_MOVE event with correct data', () => {
            group.openEditor(editor1, {});
            group.openEditor(editor2, {});
            let event!: IEditorGroupChangeEvent;
            group.onDidChangeModel(e => {
                event = e;
            });
    
            group.moveEditor(editor1, 1);
    
            assert.ok(event);
            assert.strictEqual(event?.type, EditorGroupChangeType.EDITOR_MOVE);
            assert.strictEqual(event?.model, editor1);
            assert.strictEqual(event?.modelIndex, 1);
        });
    
        test('should not fire an event for non-existent editor close', () => {
            let eventFired = false;
            group.onDidChangeModel(() => {
                eventFired = true;
            });
    
            group.closeEditor(editor1, {});
    
            assert.strictEqual(eventFired, false);
        });
    
        test('should not fire an event for non-existent editor move', () => {
            let eventFired = false;
            group.onDidChangeModel(() => {
                eventFired = true;
            });
    
            group.moveEditor(editor1, 1);
    
            assert.strictEqual(eventFired, false);
        });
    });

    suite('Selection and Focus', () => {
        let group: EditorGroupModel;
        let editor1: TextEditorPaneModel;
        let editor2: TextEditorPaneModel;
        let editor3: TextEditorPaneModel;

        setup(() => FakeAsync.run(async () => {
            const [ groupModel ] = await initEditorGroupModel();
            group = groupModel;
            editor1 = new TextEditorPaneModel(URI.parse('file://test1'));
            editor2 = new TextEditorPaneModel(URI.parse('file://test2'));
            editor3 = new TextEditorPaneModel(URI.parse('file://test3'));
        }));

        suite('setSelection', () => {
            test('should update the focused editor and selection', () => {
                group.openEditor(editor1, {});
                group.openEditor(editor2, {});
                group.setSelection(editor1, [editor2]);

                assert.strictEqual(group.focused, editor1);
                assert.deepStrictEqual(group.selection, [editor1, editor2]);
            });

            test('should clear selection if focused editor is null', () => {
                group.openEditor(editor1, {});
                group.openEditor(editor2, {});
                group.setSelection(null, []);

                assert.strictEqual(group.focused, undefined);
                assert.deepStrictEqual(group.selection, []);
            });

            test('should not change selection if focused editor is not in group', () => {
                group.openEditor(editor1, {});
                group.openEditor(editor2, {});

                const prevFocused = group.focused;
                const prevSelection = group.selection;
                group.setSelection(editor3, [editor1]);

                assert.strictEqual(group.focused, prevFocused);
                assert.deepStrictEqual(group.selection, prevSelection);
            });
        });

        suite('setFocused', () => {
            test('should set only the focused editor', () => {
                group.openEditor(editor1, {});
                group.openEditor(editor2, {});
                group.setFocused(editor1);

                assert.strictEqual(group.focused, editor1);
                assert.deepStrictEqual(group.selection, [editor1]);
            });

            test('should clear selection if focused editor is null', () => {
                group.openEditor(editor1, {});
                group.setFocused(null);

                assert.strictEqual(group.focused, undefined);
                assert.deepStrictEqual(group.selection, []);
            });
        });

        suite('isSelected', () => {
            test('should return true for editors in the selection', () => {
                group.openEditor(editor1, {});
                group.openEditor(editor2, {});
                group.setSelection(editor1, [editor2]);

                assert.strictEqual(group.isSelected(editor2), true);
            });

            test('should return false for editors not in the selection', () => {
                group.openEditor(editor1, {});
                group.openEditor(editor2, {});

                assert.strictEqual(group.isSelected(editor2), false);
            });
        });

        suite('isFocused', () => {
            test('should return true for the focused editor', () => {
                group.openEditor(editor1, {});
                group.setFocused(editor1);

                assert.strictEqual(group.isFocused(editor1), true);
            });

            test('should return false for non-focused editors', () => {
                group.openEditor(editor1, {});
                group.openEditor(editor2, {});
                group.setFocused(editor1);

                assert.strictEqual(group.isFocused(editor2), false);
            });
        });

        suite('closeEditor with openAfterClose option', () => {
            test('should focus next editor after close', () => {
                group.openEditor(editor1, {});
                group.openEditor(editor2, {});
                group.setFocused(editor1);

                group.closeEditor(editor1, { openAfterClose: true });

                assert.strictEqual(group.focused, editor2);
                assert.deepStrictEqual(group.selection, [editor2]);
            });

            test('should focus previous editor if closing the last editor', () => {
                group.openEditor(editor1, {});
                group.openEditor(editor2, {});
                group.setFocused(editor2);

                group.closeEditor(editor2, { openAfterClose: true });

                assert.strictEqual(group.focused, editor1);
                assert.deepStrictEqual(group.selection, [editor1]);
            });

            test('should clear selection if the last editor is closed', () => {
                group.openEditor(editor1, {});
                group.setFocused(editor1);

                group.closeEditor(editor1, { openAfterClose: true });

                assert.strictEqual(group.focused, undefined);
                assert.deepStrictEqual(group.selection, []);
            });

            test('should not change selection if openAfterClose is false', () => {
                group.openEditor(editor1, {});
                group.openEditor(editor2, {});
                group.setFocused(editor1);

                group.closeEditor(editor1, { openAfterClose: false });

                assert.strictEqual(group.focused, undefined);
                assert.deepStrictEqual(group.selection, []);
            });
        });

        suite('configuration: focusRecentEditorAfterClose', () => {
            test('should focus the most recently used editor after close when focusRecentEditorAfterClose is true', () => FakeAsync.run(async () => {
                const [ group, configurationService ] = await initEditorGroupModel();
                await configurationService.set(WorkbenchConfiguration.FocusRecentEditorAfterClose, true, { type: ConfigurationModuleType.User });
        
                group.openEditor(editor1, {});
                group.openEditor(editor2, {});
                group.openEditor(editor3, {});
        
                group.setFocused(editor2);
                group.closeEditor(editor2, { openAfterClose: true });
        
                assert.strictEqual(group.focused, editor3);
                assert.deepStrictEqual(group.selection, [editor3]);
            }));
        
            test('should focus the next sequential editor after close when focusRecentEditorAfterClose is false', () => FakeAsync.run(async () => {
                const [ group, configurationService ] = await initEditorGroupModel();
                await configurationService.set(WorkbenchConfiguration.FocusRecentEditorAfterClose, false, { type: ConfigurationModuleType.User });
        
                group.openEditor(editor1, {});
                group.openEditor(editor2, {});
                group.openEditor(editor3, {});
        
                group.setFocused(editor2);
                group.closeEditor(editor2, { openAfterClose: true });
        
                assert.strictEqual(group.focused, editor3);
                assert.deepStrictEqual(group.selection, [editor3]);
            }));
        
            test('should focus the previous sequential editor if closing the last editor and focusRecentEditorAfterClose is false', () => FakeAsync.run(async () => {
                const [ group, configurationService ] = await initEditorGroupModel();
                await configurationService.set(WorkbenchConfiguration.FocusRecentEditorAfterClose, false, { type: ConfigurationModuleType.User });
        
                group.openEditor(editor1, {});
                group.openEditor(editor2, {});
                group.openEditor(editor3, {});
        
                group.setFocused(editor3);
                group.closeEditor(editor3, { openAfterClose: true });
        
                assert.strictEqual(group.focused, editor2);
                assert.deepStrictEqual(group.selection, [editor2]);
            }));
        
            test('should clear focus and selection if the last editor is closed and focusRecentEditorAfterClose is true', () => FakeAsync.run(async () => {
                const [ group, configurationService ] = await initEditorGroupModel();
                await configurationService.set(WorkbenchConfiguration.FocusRecentEditorAfterClose, true, { type: ConfigurationModuleType.User });
        
                group.openEditor(editor1, {});
                group.setFocused(editor1);
        
                group.closeEditor(editor1, { openAfterClose: true });
        
                assert.strictEqual(group.focused, undefined);
                assert.deepStrictEqual(group.selection, []);
            }));
        
            test('should not change selection if openAfterClose is false, regardless of focusRecentEditorAfterClose setting', () => FakeAsync.run(async () => {
                const [ group, configurationService ] = await initEditorGroupModel();
                await configurationService.set(WorkbenchConfiguration.FocusRecentEditorAfterClose, true, { type: ConfigurationModuleType.User });
        
                group.openEditor(editor1, {});
                group.openEditor(editor2, {});
                group.setFocused(editor1);
        
                group.closeEditor(editor1, { openAfterClose: false });
                assert.strictEqual(group.size, 1);
        
                assert.strictEqual(group.focused, undefined);
                assert.deepStrictEqual(group.selection, []);
            }));
        });
    });

    suite('configuration: EditorOpenPositioning', () => {
        test('should open a new editor at the first position when positioning is set to "First"', () => FakeAsync.run(async () => {
            const [ group, configurationService ] = await initEditorGroupModel();
            await configurationService.set(WorkbenchConfiguration.EditorOpenPositioning, EditorGroupOpenPositioning.First, { type: ConfigurationModuleType.User });
            const editor1 = new TextEditorPaneModel(URI.parse('file://test1'));
            const editor2 = new TextEditorPaneModel(URI.parse('file://test2'));
    
            group.openEditor(editor1, {});
            group.openEditor(editor2, {});
    
            const editors = group.getEditors('sequential');
            assert.strictEqual(editors[0], editor2);
            assert.strictEqual(editors[1], editor1);
        }));
    
        test('should open a new editor at the last position when positioning is set to "Last"', () => FakeAsync.run(async () => {
            const [ group, configurationService ] = await initEditorGroupModel();
            await configurationService.set(WorkbenchConfiguration.EditorOpenPositioning, EditorGroupOpenPositioning.Last, { type: ConfigurationModuleType.User });
            const editor1 = new TextEditorPaneModel(URI.parse('file://test1'));
            const editor2 = new TextEditorPaneModel(URI.parse('file://test2'));
    
            group.openEditor(editor1, {});
            group.openEditor(editor2, {});
    
            const editors = group.getEditors('sequential');
            assert.strictEqual(editors[0], editor1);
            assert.strictEqual(editors[1], editor2);
        }));
    
        test('should open a new editor to the left of the focused editor when positioning is set to "Left"', () => FakeAsync.run(async () => {
            const [ group, configurationService ] = await initEditorGroupModel();
            await configurationService.set(WorkbenchConfiguration.EditorOpenPositioning, EditorGroupOpenPositioning.Left, { type: ConfigurationModuleType.User });
            const editor1 = new TextEditorPaneModel(URI.parse('file://test1'));
            const editor2 = new TextEditorPaneModel(URI.parse('file://test2'));
            const editor3 = new TextEditorPaneModel(URI.parse('file://test3'));
    
            group.openEditor(editor1, {});
            group.openEditor(editor2, {});
            group.setFocused(editor1);
            group.openEditor(editor3, {});
    
            const editors = group.getEditors('sequential');
            assert.strictEqual(editors[0], editor2);
            assert.strictEqual(editors[1], editor3);
            assert.strictEqual(editors[2], editor1);
        }));
    
        test('should open a new editor to the right of the focused editor when positioning is set to "Right"', () => FakeAsync.run(async () => {
            const [ group, configurationService ] = await initEditorGroupModel();
            await configurationService.set(WorkbenchConfiguration.EditorOpenPositioning, EditorGroupOpenPositioning.Right, { type: ConfigurationModuleType.User });
            const editor1 = new TextEditorPaneModel(URI.parse('file://test1'));
            const editor2 = new TextEditorPaneModel(URI.parse('file://test2'));
            const editor3 = new TextEditorPaneModel(URI.parse('file://test3'));
    
            group.openEditor(editor1, {});
            group.openEditor(editor2, {});
            group.setFocused(editor1);
            group.openEditor(editor3, {});
    
            const editors = group.getEditors('sequential');
            assert.strictEqual(editors[0], editor1);
            assert.strictEqual(editors[1], editor3);
            assert.strictEqual(editors[2], editor2);
        }));
    
        test('should insert the editor at a specific index if specified in options', () => FakeAsync.run(async () => {
            const [ group, configurationService ] = await initEditorGroupModel();
            const editor1 = new TextEditorPaneModel(URI.parse('file://test1'));
            const editor2 = new TextEditorPaneModel(URI.parse('file://test2'));
            const editor3 = new TextEditorPaneModel(URI.parse('file://test3'));
    
            group.openEditor(editor1, {});
            group.openEditor(editor2, {});
            group.openEditor(editor3, { index: 1 });
    
            const editors = group.getEditors('sequential');
            assert.strictEqual(editors[0], editor1);
            assert.strictEqual(editors[1], editor3);
            assert.strictEqual(editors[2], editor2);
        }));
    });
});