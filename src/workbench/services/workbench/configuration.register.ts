import { CollapseState } from "src/base/browser/basic/dom";
import { LanguageType } from "src/platform/i18n/common/i18n";
import { RegistrantType, createRegister } from "src/platform/registrant/common/registrant";
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
}

/**
 * {@link sharedWorkbenchConfigurationRegister}
 * {@link sharedNavigationViewConfigurationRegister}
 * {@link sharedWorkspaceConfigurationRegister}
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
                            enum: [LanguageType.en, LanguageType["zh-cn"], LanguageType["zh-tw"]],
                            default: LanguageType.en,
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
                        }
                    }
                },
            },
        });
    },
);