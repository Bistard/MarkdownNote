import { CollapseState } from "src/base/browser/basic/dom";
import { LanguageType } from "src/platform/i18n/common/i18n";
import { RegistrantType, createRegister } from "src/platform/registrant/common/registrant";
import { EditorGroupOpenPositioning } from "src/workbench/parts/workspace/editorGroupModel";
import { IncrementFileType } from "src/workbench/services/fileTree/fileCommands";
import { FileSortOrder, FileSortType } from "src/workbench/services/fileTree/fileTreeSorter";
import { PresetColorTheme } from "src/workbench/services/theme/theme";

export const enum WorkbenchConfiguration {

    // [workbench]

    DisplayLanguage = 'workbench.language',
    ColorTheme = 'workbench.colorTheme',
    KeyboardScreenCast = 'workbench.keyboardScreenCast',

    // [navigationView]
    
    DefaultNavigationView       = 'navigationView.defaultView',
    ExplorerViewMode            = 'navigationView.explorer.mode',
    ExplorerViewInclude         = 'navigationView.explorer.include',
    ExplorerViewExclude         = 'navigationView.explorer.exclude',
    ExplorerFileSortType        = 'navigationView.explorer.fileSortType',
    ExplorerFileSortOrder       = 'navigationView.explorer.fileSortOrder',
    ExplorerConfirmDragAndDrop  = 'navigationView.explorer.confirmDragAndDrop',
    ExplorerIncrementFileNaming = 'navigationView.explorer.incrementFileNaming',

    // [workspace]

    RestorePrevious    = 'workspace.restorePrevious',
    OutlineToggleState = 'workspace.outline.toggleState',
    
    FocusRecentEditorAfterClose = 'workspace.group.focusRecentEditorAfterClose',
    EditorOpenPositioning       = 'workspace.group.editorOpenPositioning',

    // [editor]
    EditorAutoSave            = 'editor.autoSave',
    EditorAutoSaveDelay       = 'editor.autoSaveDelay',
    EditorAutoSaveOnLoseFocus = 'editor.autoSaveOnLoseFocus'
}

/**
 * {@link sharedWorkbenchConfigurationRegister}
 * {@link sharedNavigationViewConfigurationRegister}
 * {@link sharedWorkspaceConfigurationRegister}
 * {@link sharedEditorConfigurationRegister}
 */

export const sharedWorkbenchConfigurationRegister = createRegister(
    RegistrantType.Configuration,
    'rendererWorkbench',
    (registrant) => {
        registrant.registerConfigurations({
            id: 'workbench',
            properties: {

                // workbench configurations
                ['workbench']: {
                    type: 'object',
                    required: [],
                    properties: {
                        ['language']: {
                            type: 'string',
                            enum: [LanguageType.preferOS, LanguageType.en, LanguageType.zhCN, LanguageType.zhTW],
                            default: LanguageType.preferOS,
                        },
                        ['colorTheme']: {
                            type: 'string',
                            default: PresetColorTheme.LightModern,
                        },
                        ['keyboardScreenCast']: {
                            type: 'boolean',
                            default: true,
                        }
                    }
                },
            },
        });
    },
);

export const sharedNavigationViewConfigurationRegister = createRegister(
    RegistrantType.Configuration,
    'rendererNavigationView',
    (registrant) => {
        registrant.registerConfigurations({
            id: 'navigationView',
            properties: {

                // navigationView configurations
                ['navigationView']: {
                    type: 'object',
                    properties: {
                        ['defaultView']: {
                            type: 'string',
                            default: 'explorer',
                        },
                        ['explorer']: {
                            type: 'object',
                            properties: {
                                ['include']: {
                                    type: 'array',
                                    default: ['^\\..*'],
                                },
                                ['exclude']: {
                                    type: 'array',
                                    default: [''],
                                },
                                ['fileSortType']: {
                                    type: 'string',
                                    enum: [
                                        FileSortType.Default,
                                        FileSortType.ModificationTime,
                                        FileSortType.Alphabet,
                                        FileSortType.CreationTime,
                                        FileSortType.Custom,
                                    ],
                                    default: FileSortType.Custom,
                                },
                                ['fileSortOrder']: {
                                    type: 'string',
                                    enum: [
                                        FileSortOrder.Ascending,
                                        FileSortOrder.Descending,
                                    ],
                                    default: FileSortOrder.Ascending,
                                },
                                ['confirmDragAndDrop']: {
                                    type: 'boolean',
                                    default: true,
                                },
                                ['incrementFileNaming']: {
                                    type: 'string',
                                    default: IncrementFileType.Simple,
                                    enum: [IncrementFileType.Simple, IncrementFileType.Smart],
                                }
                            }
                        }
                    }
                },
            },
        });
    },
);

export const sharedWorkspaceConfigurationRegister = createRegister(
    RegistrantType.Configuration,
    'rendererWorkspace',
    (registrant) => {
        registrant.registerConfigurations({
            id: 'workspace',
            properties: {

                // workspace configurations
                ['workspace']: {
                    type: 'object',
                    properties: {
                        ['restorePrevious']: {
                            type: 'boolean',
                            default: true,
                            description: 'Whether application should restore to previous opened directory.'
                        },
                        ['outline']: {
                            type: 'object',
                            properties: {
                                ['toggleState']: {
                                    type: 'string',
                                    enum: [CollapseState.Expand, CollapseState.Collapse],
                                    default: CollapseState.Expand
                                }
                            }
                        },
                        ['group']: {
                            type: 'object',
                            properties: {
                                ['focusRecentEditorAfterClose']: {
                                    type: 'boolean',
                                    default: false,
                                },
                                ['editorOpenPositioning']: {
                                    type: 'string',
                                    default: EditorGroupOpenPositioning.Right,
                                    enum: [
                                        EditorGroupOpenPositioning.Right,
                                        EditorGroupOpenPositioning.Left,
                                        EditorGroupOpenPositioning.First,
                                        EditorGroupOpenPositioning.Last,
                                    ],
                                },
                            }
                        },
                    }
                },
            },
        });
    },
);

export const sharedEditorConfigurationRegister = createRegister(
    RegistrantType.Configuration,
    'rendererEditor',
    (registrant) => {
        registrant.registerConfigurations({
            id: 'editor',
            properties: {

                // editor configurations
                ['editor']: {
                    type: 'object',
                    properties: {
                        ['autoSave']: {
                            type: 'boolean',
                            default: false,
                        },
                        ['autoSaveDelay']: {
                            type: 'number',
                            default: 1000,
                            minimum: 0,
                        },
                        ['autoSaveOnLoseFocus']: {
                            type: 'boolean',
                            default: false,
                        }
                    }
                },
            },
        });
    }
);
