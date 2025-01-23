import { createRegister, RegistrantType } from "src/platform/registrant/common/registrant";
import { IS_MAC } from "src/base/common/platform";
import { MenuTypes, IMenuItemRegistration } from "src/platform/menu/common/menu";
import { AllCommands } from "src/workbench/services/workbench/commandList";

// Title Bar Menu
export const menuTitleBarRegister = createRegister(
    RegistrantType.Menu,
    'menuTitleBarRegister',
    (registrant) => {
        const menuItems: IMenuItemRegistration[] = [
            {
                group: '_',
                title: 'File',
                submenu: MenuTypes.TitleBarFile,
                command: { commandID: "", },
            },
            {
                group: '_',
                title: 'Edit',
                submenu: MenuTypes.TitleBarEdit,
                command: { commandID: "", },
            },
            {
                group: '_',
                title: 'Selection',
                submenu: MenuTypes.TitleBarSelection,
                command: { commandID: "", },
            },
            {
                group: '_',
                title: 'Insert',
                submenu: MenuTypes.TitleBarInsert,
                command: { commandID: "", },
            },
            {
                group: '_',
                title: 'Format',
                submenu: MenuTypes.TitleBarFormat,
                command: { commandID: "", },
            },
            {
                group: '_',
                title: 'View',
                submenu: MenuTypes.TitleBarView,
                command: { commandID: "", },
            },
            {
                group: '_',
                title: 'Help',
                submenu: MenuTypes.TitleBarHelp,
                command: { commandID: "", },
            },
        ];

        for (const item of menuItems) {
            registrant.registerMenuItem(MenuTypes.TitleBar, item);
        }
    }
); 

// Application Menu (For macOS)
export const menuTitleApplicationRegister = createRegister(
    RegistrantType.Menu,
    'menuTitleApplicationRegister',
    (registrant) => {
        const menuItems: IMenuItemRegistration[] = [
            {
                group: '1_about',
                title: 'About Nota',
                command: {
                    // commandID: AllCommands.About,
                    commandID: "",
                },
            },
            {
                group: '2_updates',
                title: 'Check for Updates...',
                command: {
                    // commandID: AllCommands.CheckForUpdates,
                    commandID: "",
                },
            },
            {
                group: '3_settings',
                title: 'Settings...',
                command: {
                    // commandID: AllCommands.OpenSettings,
                    commandID: "",
                },
            },
            {
                group: '5_window',
                title: `Hide Nota`,
                command: {
                    // commandID: AllCommands.HideApp,
                    commandID: "",
                    keybinding: IS_MAC ? 'Cmd+H' : undefined,
                },
            },
            {
                group: '5_window',
                title: 'Hide Others',
                command: {
                    // commandID: AllCommands.HideOthers,
                    commandID: "",
                    keybinding: IS_MAC ? 'Cmd+Alt+H' : undefined,
                },
            },
            {
                group: '5_window',
                title: 'Show All',
                command: {
                    // commandID: AllCommands.ShowAll,
                    commandID: "",
                },
            },
            {
                group: '6_quit',
                title: IS_MAC ? 'Quit Nota' : 'Exit Nota',
                command: {
                    // commandID: AllCommands.ExitApp,
                    commandID: "",
                    keybinding: IS_MAC ? 'Cmd+Q' : undefined,
                },
            },
        ];

        for (const item of menuItems) {
            registrant.registerMenuItem(MenuTypes.TitleBarApplication, item);
        }
    }
);

// File Menu
export const menuTitleFileRegister = createRegister(
    RegistrantType.Menu,
    'menuTitleFileRegister',
    (registrant) => {
        const fileMenuItems: IMenuItemRegistration[] = [
            // New Operations
            {
                group: '1_new',
                title: 'New File',
                command: {
                    // commandID: AllCommands.NewFile,
                    commandID: "",
                    keybinding: IS_MAC ? 'Cmd+N' : 'Ctrl+N',
                },
            },
            {
                group: '1_new',
                title: 'New Tab',
                command: {
                    // commandID: AllCommands.NewTab,
                    commandID: "",
                    keybinding: IS_MAC ? 'Cmd+T' : 'Ctrl+T',
                },
            },
            {
                group: '1_new',
                title: 'New Window',
                command: {
                    // commandID: AllCommands.NewWindow,
                    commandID: "",
                    keybinding: IS_MAC ? 'Cmd+Shift+N' : 'Ctrl+Shift+N',
                },
            },
            // Separator
            // Open Operations
            {
                group: '2_open',
                title: 'Open File…',
                command: {
                    // commandID: AllCommands.OpenFile,
                    commandID: "",
                    keybinding: IS_MAC ? 'Cmd+O' : 'Ctrl+O',
                },
            },
            {
                group: '2_open',
                title: 'Open Folder…',
                command: {
                    commandID: AllCommands.openFolderDialog,
                },
            },
            {
                group: '2_open',
                title: 'Open Recent',
                command: {
                    commandID: "",
                },
                submenu: MenuTypes.FileRecentOpen,
            },
            // Separator
            // Save Operations
            {
                group: '3_save',
                title: 'Save',
                command: {
                    // commandID: AllCommands.Save,
                    commandID: "",
                    keybinding: IS_MAC ? 'Cmd+S' : 'Ctrl+S',
                },
            },
            {
                group: '3_save',
                title: 'Save As…',
                command: {
                    // commandID: AllCommands.SaveAs,
                    commandID: "",
                    keybinding: IS_MAC ? 'Shift+Cmd+S' : 'Ctrl+Shift+S',
                },
            },
            {
                group: '3_save',
                title: 'Save All',
                command: {
                    // commandID: AllCommands.SaveAll,
                    commandID: "",
                },
            },
            {
                group: '3_save',
                title: 'Reveal In Explorer/Finder',
                command: {
                    // commandID: AllCommands.RevealInExplorer,
                    commandID: "",
                },
            },
            // Separator
            // Export Operations
            {
                group: '4_export',
                title: 'Export As',
                command: {
                    commandID: "",
                },
                submenu: MenuTypes.FileExportAs,
            },
            {
                group: '4_export',
                title: 'Print…',
                command: {
                    // commandID: AllCommands.Print,
                    commandID: "",
                    keybinding: IS_MAC ? 'Cmd+P' : 'Ctrl+P',
                },
            },
            // Separator
            // Auto Save
            {
                group: '5_auto_save',
                title: 'Auto Save',
                command: {
                    // commandID: AllCommands.ToggleAutoSave,
                    commandID: "",
                },
            },
            // Separator
            // Close Operations
            {
                group: '6_close',
                title: 'Close Current File',
                command: {
                    // commandID: AllCommands.CloseFile,
                    commandID: "",
                    keybinding: IS_MAC ? 'Cmd+W' : 'Ctrl+W',
                },
            },
            {
                group: '6_close',
                title: 'Close Current Folder',
                command: {
                    commandID: AllCommands.fileTreeCloseCurrentFolder,
                },
            },
            {
                group: '6_close',
                title: 'Close Current Window',
                command: {
                    commandID: AllCommands.closeApplication,
                },
            },
        ];

        for (const item of fileMenuItems) {
            registrant.registerMenuItem(MenuTypes.TitleBarFile, item);
        }

        // Register 'Export As' submenu items
        const exportAsMenuItems: IMenuItemRegistration[] = [
            {
                group: '1_export_options',
                title: 'Export as PDF',
                command: {
                    // commandID: AllCommands.ExportAsPDF,
                    commandID: "",
                },
            },
            {
                group: '1_export_options',
                title: 'Export as HTML',
                command: {
                    // commandID: AllCommands.ExportAsHTML,
                    commandID: "",
                },
            },
            // Add other export options as needed
        ];

        for (const item of exportAsMenuItems) {
            registrant.registerMenuItem(MenuTypes.FileExportAs, item);
        }
    }
);

// Edit Menu
export const menuTitleEditRegister = createRegister(
    RegistrantType.Menu,
    'menuTitleEditRegister',
    (registrant) => {
        const editMenuItems: IMenuItemRegistration[] = [
            // Undo/Redo
            {
                group: '1_undo_redo',
                title: 'Undo',
                command: {
                    // commandID: AllCommands.Undo,
                    commandID: "",
                    keybinding: IS_MAC ? 'Cmd+Z' : 'Ctrl+Z',
                },
            },
            {
                group: '1_undo_redo',
                title: 'Redo',
                command: {
                    // commandID: AllCommands.Redo,
                    commandID: "",
                    keybinding: IS_MAC ? 'Shift+Cmd+Z' : 'Ctrl+Y',
                },
            },
            // Separator
            // Clipboard
            {
                group: '2_clipboard',
                title: 'Cut',
                command: {
                    // commandID: AllCommands.Cut,
                    commandID: "",
                    keybinding: IS_MAC ? 'Cmd+X' : 'Ctrl+X',
                },
            },
            {
                group: '2_clipboard',
                title: 'Copy',
                command: {
                    // commandID: AllCommands.Copy,
                    commandID: "",
                    keybinding: IS_MAC ? 'Cmd+C' : 'Ctrl+C',
                },
            },
            {
                group: '2_clipboard',
                title: 'Paste',
                command: {
                    // commandID: AllCommands.Paste,
                    commandID: "",
                    keybinding: IS_MAC ? 'Cmd+V' : 'Ctrl+V',
                },
            },
            // Separator
            // Find/Replace
            {
                group: '3_find',
                title: 'Find',
                command: {
                    // commandID: AllCommands.Find,
                    commandID: "",
                    keybinding: IS_MAC ? 'Cmd+F' : 'Ctrl+F',
                },
            },
            {
                group: '3_find',
                title: 'Replace',
                command: {
                    // commandID: AllCommands.Replace,
                    commandID: "",
                    keybinding: IS_MAC ? 'Cmd+Alt+F' : 'Ctrl+H',
                },
            },
            // Separator
            {
                group: '4_find_in_files',
                title: 'Find In Files',
                command: {
                    // commandID: AllCommands.FindInFiles,
                    commandID: "",
                    keybinding: IS_MAC ? 'Shift+Cmd+F' : 'Ctrl+Shift+F',
                },
            },
            {
                group: '4_find_in_files',
                title: 'Replace In Files',
                command: {
                    // commandID: AllCommands.ReplaceInFiles,
                    commandID: "",
                    keybinding: IS_MAC ? 'Shift+Cmd+H' : 'Ctrl+Shift+H',
                },
            },
        ];

        for (const item of editMenuItems) {
            registrant.registerMenuItem(MenuTypes.TitleBarEdit, item);
        }
    }
);

// Selection Menu
export const menuTitleSelectionRegister = createRegister(
    RegistrantType.Menu,
    'menuTitleSelectionRegister',
    (registrant) => {
        const selectionMenuItems: IMenuItemRegistration[] = [
            // Select Operations
            {
                group: '1_select',
                title: 'Select All',
                command: {
                    // commandID: AllCommands.SelectAll,
                    commandID: "",
                    keybinding: IS_MAC ? 'Cmd+A' : 'Ctrl+A',
                },
            },
            {
                group: '1_select',
                title: 'Select Block',
                command: {
                    // commandID: AllCommands.SelectBlock,
                    commandID: "",
                },
            },
            {
                group: '1_select',
                title: 'Select Line',
                command: {
                    // commandID: AllCommands.SelectLine,
                    commandID: "",
                },
            },
            {
                group: '1_select',
                title: 'Select Word',
                command: {
                    // commandID: AllCommands.SelectWord,
                    commandID: "",
                },
            },
            // Separator
            // Move Operations
            {
                group: '2_move',
                title: 'Move Line Up',
                command: {
                    // commandID: AllCommands.MoveLineUp,
                    commandID: "",
                    keybinding: IS_MAC ? 'Option+Up' : 'Alt+Up',
                },
            },
            {
                group: '2_move',
                title: 'Move Line Down',
                command: {
                    // commandID: AllCommands.MoveLineDown,
                    commandID: "",
                    keybinding: IS_MAC ? 'Option+Down' : 'Alt+Down',
                },
            },
            {
                group: '2_move',
                title: 'Move Block Up',
                command: {
                    // commandID: AllCommands.MoveBlockUp,
                    commandID: "",
                },
            },
            {
                group: '2_move',
                title: 'Move Block Down',
                command: {
                    // commandID: AllCommands.MoveBlockDown,
                    commandID: "",
                },
            },
            // Separator
            // Jump Operations
            {
                group: '3_jump',
                title: 'Jump To Top',
                command: {
                    // commandID: AllCommands.JumpToTop,
                    commandID: "",
                    keybinding: IS_MAC ? 'Cmd+Up' : 'Ctrl+Home',
                },
            },
            {
                group: '3_jump',
                title: 'Jump To Bottom',
                command: {
                    // commandID: AllCommands.JumpToBottom,
                    commandID: "",
                    keybinding: IS_MAC ? 'Cmd+Down' : 'Ctrl+End',
                },
            },
            {
                group: '3_jump',
                title: 'Jump To Selection',
                command: {
                    // commandID: AllCommands.JumpToSelection,
                    commandID: "",
                },
            },
            {
                group: '3_jump',
                title: 'Jump to Line Start',
                command: {
                    // commandID: AllCommands.JumpToLineStart,
                    commandID: "",
                    keybinding: IS_MAC ? 'Cmd+Left' : 'Home',
                },
            },
            {
                group: '3_jump',
                title: 'Jump to Line End',
                command: {
                    // commandID: AllCommands.JumpToLineEnd,
                    commandID: "",
                    keybinding: IS_MAC ? 'Cmd+Right' : 'End',
                },
            },
        ];

        for (const item of selectionMenuItems) {
            registrant.registerMenuItem(MenuTypes.TitleBarSelection, item);
        }
    }
);

// Insert Menu
export const menuTitleInsertRegister = createRegister(
    RegistrantType.Menu,
    'menuTitleInsertRegister',
    (registrant) => {
        const insertMenuItems: IMenuItemRegistration[] = [
            // Insert Elements
            {
                group: '1_elements',
                title: 'Paragraph',
                command: {
                    // commandID: AllCommands.InsertParagraph,
                    commandID: "",
                },
            },
            {
                group: '1_elements',
                title: 'Heading',
                command: {
                    commandID: "",
                },
                submenu: MenuTypes.InsertHeading,
            },
            {
                group: '1_elements',
                title: 'BlockQuote',
                command: {
                    // commandID: AllCommands.InsertBlockQuote,
                    commandID: "",
                },
            },
            {
                group: '1_elements',
                title: 'CodeBlock',
                command: {
                    // commandID: AllCommands.InsertCodeBlock,
                    commandID: "",
                },
            },
            {
                group: '1_elements',
                title: 'List',
                command: {
                    commandID: "",
                },
                submenu: MenuTypes.InsertList,
            },
            {
                group: '1_elements',
                title: 'Table',
                command: {
                    // commandID: AllCommands.InsertTable,
                    commandID: "",
                },
            },
            {
                group: '1_elements',
                title: 'Math Block',
                command: {
                    // commandID: AllCommands.InsertMathBlock,
                    commandID: "",
                },
            },
            {
                group: '1_elements',
                title: 'Image',
                command: {
                    commandID: "",
                },
                submenu: MenuTypes.InsertImage,
            },
            {
                group: '1_elements',
                title: 'Footnote',
                command: {
                    // commandID: AllCommands.InsertFootnote,
                    commandID: "",
                },
            },
            // Separator
            // Line Operations
            {
                group: '2_lines',
                title: 'Horizontal Line',
                command: {
                    // commandID: AllCommands.InsertHorizontalLine,
                    commandID: "",
                },
            },
            {
                group: '2_lines',
                title: 'Line Break',
                command: {
                    // commandID: AllCommands.InsertLineBreak,
                    commandID: "",
                },
            },
            // Separator
            // Paragraph Operations
            {
                group: '3_paragraph',
                title: 'New Paragraph Before Cursor',
                command: {
                    // commandID: AllCommands.NewParagraphBefore,
                    commandID: "",
                },
            },
            {
                group: '3_paragraph',
                title: 'New Paragraph After Cursor',
                command: {
                    // commandID: AllCommands.NewParagraphAfter,
                    commandID: "",
                },
            },
        ];

        for (const item of insertMenuItems) {
            registrant.registerMenuItem(MenuTypes.TitleBarInsert, item);
        }


        // Register 'Heading' submenu items
        const headingMenuItems: IMenuItemRegistration[] = [
            {
                group: '1_heading',
                title: 'Heading 1',
                command: {
                    // commandID: AllCommands.InsertHeading1,
                    commandID: "",
                },
            },
            {
                group: '1_heading',
                title: 'Heading 2',
                command: {
                    // commandID: AllCommands.InsertHeading2,
                    commandID: "",
                },
            },
            {
                group: '1_heading',
                title: 'Heading 3',
                command: {
                    // commandID: AllCommands.InsertHeading3,
                    commandID: "",
                },
            },
            {
                group: '1_heading',
                title: 'Heading 4',
                command: {
                    // commandID: AllCommands.InsertHeading4,
                    commandID: "",
                },
            },
            {
                group: '1_heading',
                title: 'Heading 5',
                command: {
                    // commandID: AllCommands.InsertHeading5,
                    commandID: "",
                },
            },
            {
                group: '1_heading',
                title: 'Heading 6',
                command: {
                    // commandID: AllCommands.InsertHeading6,
                    commandID: "",
                },
            },
        ];

        for (const item of headingMenuItems) {
            registrant.registerMenuItem(MenuTypes.InsertHeading, item);
        }

        // Register 'List' submenu items
        const listMenuItems: IMenuItemRegistration[] = [
            {
                group: '1_list',
                title: 'Ordered List',
                command: {
                    // commandID: AllCommands.InsertOrderedList,
                    commandID: "",
                },
            },
            {
                group: '1_list',
                title: 'Unordered List',
                command: {
                    // commandID: AllCommands.InsertUnorderedList,
                    commandID: "",
                },
            },
            {
                group: '1_list',
                title: 'Todo List',
                command: {
                    // commandID: AllCommands.InsertTodoList,
                    commandID: "",
                },
            },
        ];

        for (const item of listMenuItems) {
            registrant.registerMenuItem(MenuTypes.InsertList, item);
        }

        // Register 'Image' submenu items
        const imageMenuItems: IMenuItemRegistration[] = [
            {
                group: '1_image',
                title: 'Insert Empty Image',
                command: {
                    // commandID: AllCommands.InsertEmptyImage,
                    commandID: "",
                },
            },
            {
                group: '1_image',
                title: 'Insert Local Image…',
                command: {
                    // commandID: AllCommands.InsertLocalImage,
                    commandID: "",
                },
            },
            // Separator
            {
                group: '2_image_ops',
                title: 'Reveal Image In Finder/Explorer',
                command: {
                    // commandID: AllCommands.RevealImageInExplorer,
                    commandID: "",
                },
            },
            {
                group: '2_image_ops',
                title: 'Zoom Image',
                command: {
                    commandID: "",
                },
                submenu: MenuTypes.InsertImageZoom,
            },
            {
                group: '2_image_ops',
                title: 'Switch Image Syntax',
                command: {
                    commandID: "",
                },
                submenu: MenuTypes.InsertImageSwitchSyntax,
            },
            // Separator
            {
                group: '3_image_management',
                title: 'Delete Image File…',
                command: {
                    // commandID: AllCommands.DeleteImageFile,
                    commandID: "",
                },
            },
            {
                group: '3_image_management',
                title: 'Copy Image To…',
                command: {
                    // commandID: AllCommands.CopyImageTo,
                    commandID: "",
                },
            },
            {
                group: '3_image_management',
                title: 'Move Image To…',
                command: {
                    // commandID: AllCommands.MoveImageTo,
                    commandID: "",
                },
            },
            // Separator
            {
                group: '4_image_batch',
                title: 'Copy All Images to…',
                command: {
                    // commandID: AllCommands.CopyAllImagesTo,
                    commandID: "",
                },
            },
            {
                group: '4_image_batch',
                title: 'Move All Images to…',
                command: {
                    // commandID: AllCommands.MoveAllImagesTo,
                    commandID: "",
                },
            },
        ];

        for (const item of imageMenuItems) {
            registrant.registerMenuItem(MenuTypes.InsertImage, item);
        }

        // Register 'Zoom Image' submenu items
        const zoomImageMenuItems: IMenuItemRegistration[] = [
            {
                group: '1_zoom_levels',
                title: '25%',
                command: {
                    // commandID: AllCommands.ZoomImage25,
                    commandID: "",
                },
            },
            {
                group: '1_zoom_levels',
                title: '33%',
                command: {
                    // commandID: AllCommands.ZoomImage33,
                    commandID: "",
                },
            },
            {
                group: '1_zoom_levels',
                title: '50%',
                command: {
                    // commandID: AllCommands.ZoomImage50,
                    commandID: "",
                },
            },
            {
                group: '1_zoom_levels',
                title: '66%',
                command: {
                    // commandID: AllCommands.ZoomImage66,
                    commandID: "",
                },
            },
            {
                group: '1_zoom_levels',
                title: '80%',
                command: {
                    // commandID: AllCommands.ZoomImage80,
                    commandID: "",
                },
            },
            {
                group: '1_zoom_levels',
                title: '100%',
                command: {
                    // commandID: AllCommands.ZoomImage100,
                    commandID: "",
                },
            },
            {
                group: '1_zoom_levels',
                title: '150%',
                command: {
                    // commandID: AllCommands.ZoomImage150,
                    commandID: "",
                },
            },
            {
                group: '1_zoom_levels',
                title: '200%',
                command: {
                    // commandID: AllCommands.ZoomImage200,
                    commandID: "",
                },
            },
            {
                group: '1_zoom_levels',
                title: '500%',
                command: {
                    // commandID: AllCommands.ZoomImage500,
                    commandID: "",
                },
            },
        ];

        for (const item of zoomImageMenuItems) {
            registrant.registerMenuItem(MenuTypes.InsertImageZoom, item);
        }

        // Register 'Switch Image Syntax' submenu items
        const switchImageSyntaxMenuItems: IMenuItemRegistration[] = [
            {
                group: '1_syntax',
                title: 'Markdown Syntax',
                command: {
                    // commandID: AllCommands.SwitchImageToMarkdown,
                    commandID: "",
                },
            },
            {
                group: '1_syntax',
                title: 'HTML Syntax',
                command: {
                    // commandID: AllCommands.SwitchImageToHTML,
                    commandID: "",
                },
            },
        ];

        for (const item of switchImageSyntaxMenuItems) {
            registrant.registerMenuItem(MenuTypes.InsertImageSwitchSyntax, item);
        }
    }
);

// Format Menu
export const menuTitleFormatRegister = createRegister(
    RegistrantType.Menu,
    'menuTitleFormatRegister',
    (registrant) => {
        const formatMenuItems: IMenuItemRegistration[] = [
            // Text Formatting
            {
                group: '1_text',
                title: 'Strong',
                command: {
                    // commandID: AllCommands.FormatStrong,
                    commandID: "",
                    keybinding: IS_MAC ? 'Cmd+B' : 'Ctrl+B',
                },
            },
            {
                group: '1_text',
                title: 'Emphasis',
                command: {
                    // commandID: AllCommands.FormatEmphasis,
                    commandID: "",
                    keybinding: IS_MAC ? 'Cmd+I' : 'Ctrl+I',
                },
            },
            {
                group: '1_text',
                title: 'Underline',
                command: {
                    // commandID: AllCommands.FormatUnderline,
                    commandID: "",
                    keybinding: IS_MAC ? 'Cmd+U' : 'Ctrl+U',
                },
            },
            {
                group: '1_text',
                title: 'Inline Code',
                command: {
                    // commandID: AllCommands.FormatInlineCode,
                    commandID: "",
                },
            },
            {
                group: '1_text',
                title: 'Inline Math',
                command: {
                    // commandID: AllCommands.FormatInlineMath,
                    commandID: "",
                },
            },
            {
                group: '1_text',
                title: 'Strike',
                command: {
                    // commandID: AllCommands.FormatStrike,
                    commandID: "",
                },
            },
            {
                group: '1_text',
                title: 'Hyperlink',
                command: {
                    // commandID: AllCommands.InsertHyperlink,
                    commandID: "",
                },
            },
            // Image Formatting
            {
                group: '2_image',
                title: 'Image',
                command: {
                    commandID: "",
                },
                submenu: MenuTypes.FormatImage,
            },
        ];

        for (const item of formatMenuItems) {
            registrant.registerMenuItem(MenuTypes.TitleBarFormat, item);
        }

        // Register 'Image' submenu items for Format menu
        const formatImageMenuItems: IMenuItemRegistration[] = [
            {
                group: '1_image_ops',
                title: 'Reveal Image In Finder/Explorer',
                command: {
                    // commandID: AllCommands.RevealImageInExplorer,
                    commandID: "",
                },
            },
            {
                group: '1_image_ops',
                title: 'Zoom Image',
                command: {
                    commandID: "",
                },
                submenu: MenuTypes.InsertImageZoom,
            },
            {
                group: '1_image_ops',
                title: 'Switch Image Syntax',
                command: {
                    commandID: "",
                },
                submenu: MenuTypes.InsertImageSwitchSyntax,
            },
        ];

        for (const item of formatImageMenuItems) {
            registrant.registerMenuItem(MenuTypes.FormatImage, item);
        }
    }
);

// View Menu
export const menuTitleViewRegister = createRegister(
    RegistrantType.Menu,
    'menuTitleViewRegister',
    (registrant) => {
        const viewMenuItems: IMenuItemRegistration[] = [
            // Command Palette and Theme
            {
                group: '1_tools',
                title: 'Command Palette',
                command: {
                    // commandID: AllCommands.CommandPalette,
                    commandID: "",
                    keybinding: IS_MAC ? 'Shift+Cmd+P' : 'Ctrl+Shift+P',
                },
            },
            {
                group: '1_tools',
                title: 'Change Theme',
                command: {
                    commandID: "",
                },
                submenu: MenuTypes.ViewChangeTheme,
            },
            // Separator
            // View Toggles
            {
                group: '2_view',
                title: 'Always On Top',
                command: {
                    // commandID: AllCommands.ToggleAlwaysOnTop,
                    commandID: "",
                },
                // // checkbox: true,
            },
            {
                group: '2_view',
                title: 'Toggle Full Screen',
                command: {
                    // commandID: AllCommands.ToggleFullScreen,
                    commandID: "",
                    keybinding: IS_MAC ? 'Ctrl+Cmd+F' : 'F11',
                },
            },
            {
                group: '2_view',
                title: 'Toggle Outline',
                command: {
                    // commandID: AllCommands.ToggleOutline,
                    commandID: "",
                },
            },
            {
                group: '2_view',
                title: 'Toggle Typewriter Mode',
                command: {
                    // commandID: AllCommands.ToggleTypewriterMode,
                    commandID: "",
                },
            },
            // Separator
            // Mode Toggles
            {
                group: '3_mode',
                title: 'Source Code Mode',
                command: {
                    // commandID: AllCommands.ToggleSourceCodeMode,
                    commandID: "",
                },
                // checkbox: true,
            },
            {
                group: '3_mode',
                title: 'Split View Mode',
                command: {
                    // commandID: AllCommands.ToggleSplitViewMode,
                    commandID: "",
                },
                // checkbox: true,
            },
            {
                group: '3_mode',
                title: 'Rich Text Mode',
                command: {
                    // commandID: AllCommands.ToggleRichTextMode,
                    commandID: "",
                },
                // checkbox: true,
            },
            // Separator
            // Zoom Operations
            {
                group: '4_zoom',
                title: 'Zoom In',
                command: {
                    // commandID: AllCommands.ZoomIn,
                    commandID: "",
                    keybinding: IS_MAC ? 'Cmd+=' : 'Ctrl+=',
                },
            },
            {
                group: '4_zoom',
                title: 'Zoom Out',
                command: {
                    // commandID: AllCommands.ZoomOut,
                    commandID: "",
                    keybinding: IS_MAC ? 'Cmd+-' : 'Ctrl+-',
                },
            },
            {
                group: '4_zoom',
                title: 'Zoom Reset',
                command: {
                    // commandID: AllCommands.ZoomReset,
                    commandID: "",
                    keybinding: IS_MAC ? 'Cmd+0' : 'Ctrl+0',
                },
            },
        ];

        for (const item of viewMenuItems) {
            registrant.registerMenuItem(MenuTypes.TitleBarView, item);
        }

        // Register 'Change Theme' submenu items
        const changeThemeMenuItems: IMenuItemRegistration[] = [
            {
                group: '1_themes',
                title: 'Light Theme Default',
                command: {
                    // commandID: AllCommands.SelectLightTheme,
                    commandID: "",
                },
            },
            {
                group: '1_themes',
                title: 'Dark Theme Default',
                command: {
                    // commandID: AllCommands.SelectDarkTheme,
                    commandID: "",
                },
            },
            // Separator
            {
                group: '2_dynamic',
                title: 'DYNAMIC',
                command: {
                    commandID: "",
                },
            },
            // Separator
            {
                group: '3_folder',
                title: 'Open Theme Folder',
                command: {
                    // commandID: AllCommands.OpenThemeFolder,
                    commandID: "",
                },
            },
        ];

        for (const item of changeThemeMenuItems) {
            registrant.registerMenuItem(MenuTypes.ViewChangeTheme, item);
        }
    }
);

// Help Menu
export const menuTitleHelpRegister = createRegister(
    RegistrantType.Menu,
    'menuTitleHelpRegister',
    (registrant) => {
        const helpMenuItems: IMenuItemRegistration[] = [
            // Resources
            {
                group: '1_resources',
                title: 'Home Page',
                command: {
                    // commandID: AllCommands.OpenHomePage,
                    commandID: "",
                },
            },
            {
                group: '1_resources',
                title: 'Get Started',
                command: {
                    // commandID: AllCommands.GetStarted,
                    commandID: "",
                },
            },
            {
                group: '1_resources',
                title: 'Tips and Tricks',
                command: {
                    // commandID: AllCommands.TipsAndTricks,
                    commandID: "",
                },
            },
            {
                group: '1_resources',
                title: 'Show Release Notes',
                command: {
                    // commandID: AllCommands.ShowReleaseNotes,
                    commandID: "",
                },
            },
            // Separator
            // Feedback
            {
                group: '2_feedback',
                title: 'Report Issues or Bugs',
                command: {
                    // commandID: AllCommands.ReportIssue,
                    commandID: "",
                },
            },
            {
                group: '2_feedback',
                title: 'Request New Feature',
                command: {
                    // commandID: AllCommands.RequestFeature,
                    commandID: "",
                },
            },
            // Separator
            // License and Tools
            {
                group: '3_info',
                title: 'View License',
                command: {
                    // commandID: AllCommands.ViewLicense,
                    commandID: "",
                },
            },
            // Separator
            {
                group: '4_tools',
                title: 'Toggle Developer Tool',
                command: {
                    commandID: AllCommands.toggleDevTool,
                    keybinding: IS_MAC ? 'Alt+Cmd+I' : 'Ctrl+Shift+I',
                },
            },
            {
                group: '4_tools',
                title: 'Toggle Inspector Tool',
                command: {
                    commandID: AllCommands.toggleInspector,
                },
            },
            // Separator
            // Updates and About
            {
                group: '5_updates',
                title: 'Check For Updates…',
                command: {
                    // commandID: AllCommands.CheckForUpdates,
                    commandID: "",
                },
            },
            {
                group: '5_updates',
                title: 'About…',
                command: {
                    // commandID: AllCommands.About,
                    commandID: "",
                },
            },
        ];

        for (const item of helpMenuItems) {
            registrant.registerMenuItem(MenuTypes.TitleBarHelp, item);
        }
    }
);
