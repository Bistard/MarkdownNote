const ConfigModule = require('./js/config')
const ActionBarModule = require('./js/actionBar/actionBar')
const TitleBarModule = require('./js/titleBar/titleBar')
const FolderTreeModule = require('./js/actionView/folderView/folderTree')
const TabBarModule = require('./js/actionView/folderView/tabBar')
const FolderModule = require('./js/actionView/folderView/folder')
const MarkdownModule = require('./js/markdown/markdown')

/**
 * @description this module is loaded by the web directly. Most of the modules 
 * are instantiating in here. Also convinents for passing diferent modules into
 * others.
 */
class mainMoudle {

    constructor() {
        this.Config = new ConfigModule.ConfigModule()
        this.ActionBar = new ActionBarModule.ActionBarModule()
        this.TitleBar = new TitleBarModule.TitleBarModule()
        this.FolderTree = new FolderTreeModule.FolderTreeModule()
        this.TabBar = new TabBarModule.TabBarModule(this.Config)
        this.Folder = new FolderModule.FolderModule(this.FolderTree, this.TabBar)
        this.Markdown = new MarkdownModule.MarkdownModule(this.Config, this.Folder)
    }

}

// since it is loaded by the web which is sepreated by the main.js, it needs to 
// be instantiated individually.
new mainMoudle()

