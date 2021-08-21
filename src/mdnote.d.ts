declare module 'mdnote' {

    export type MarkdownRenderMode = 'wysiwyg' | 'instant' | 'split';
    export type ActionViewType = 'none' | 'folder' | 'outline' | 'search' | 'git';
    export type TreeNodesType = { [propName: string]: FileNode; };
    export type TreeNodeType = 'root' | 'folder' | 'file';


}
