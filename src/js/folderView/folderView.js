const { ipcRenderer } = require('electron')
const FolderTreeModule = require('./folderTree')
const TabBarModule = require('./tabBar.js')

const folderBtn = document.getElementById('folderBtn')
const outlineBtn = document.getElementById('outlineBtn')
const folderView = document.getElementById('folderView')
const folderTree = document.getElementById('folderTree')
const tree = document.getElementById('tree')
const emptyFolderTag = document.getElementById('emptyFolderTag')
const mdView = document.getElementById('mdView')
const resize = document.getElementById("resize")

class FolderViewModule {

    constructor() {
        this.FolderTree = new FolderTreeModule.FolderTreeModule()
        this.tabBar = new TabBarModule.TabBarModule()

        this.isFileClicked = true
        this.isOutlineClicked = false
        this.resizeX = null

        this.isFolderOpened = false
        this.treeNodeCount = 0

        this.initFolderView()
        this.setListeners()
    }

    initFolderView() {
        this.folderBtnSelected(true)
        folderTree.removeChild(tree)
    }

    displayFolderTree(root) {
        let current = this.insertNode($('#tree'), root, 'root')
        this.displayTree(current, root.nodes)
    }

    displayTree(parent, tree) {
        for (const [name, node] of Object.entries(tree)) {
            if (node.isFolder) {
                let current = this.insertNode(parent, node, 'folder')
                this.displayTree(current, node.nodes)
            } else {
                this.insertNode(parent, node, 'file')
            }
        }
    }

    insertNode(parent, nodeInfo, state) {
        let element;
        if (state == 'root' || state == 'folder') {
            element = document.createElement('ul')
        } else {
            element = document.createElement('li')
        }

        element.classList.add('node')
        let nodeNum = this.treeNodeCount.toString()
        element.setAttribute('nodeNum', nodeNum)
        this.treeNodeCount++

        const text = document.createElement('li')
        text.classList.add('node-text')
        text.innerHTML = nodeInfo.baseName
        
        if (state == 'file') {
            element.classList.add('node-file')
            text.classList.add('file-icon')
        } else if (state == 'folder' || state == 'root') {
            if (state == 'folder') {
                element.classList.add('node-folder')
            } else {
                element.classList.add('node-root')
            }
            
            if (nodeInfo.isExpand) {
                text.classList.add('folder-icon-expand')
            } else {
                text.classList.add('folder-icon-collapse')
            }  
        }
        
        element.append(text)
        parent.append(element)
        return element
    }

    expandOrCollapseFolder(element, shouldExpand) {
        if (shouldExpand) {
            element.removeClass('folder-icon-collapse')
            element.addClass('folder-icon-expand')
            element.each(function() {
                element.nextAll().each(function() {
                    $(this).show(0)
                })
            })
        } else {
            element.addClass('folder-icon-collapse')
            element.removeClass('folder-icon-expand')
            element.each(function() {
                element.nextAll().each(function() {
                    $(this).hide(0)
                })
            })
        }
    }

    folderLeftClicked(element, nodeInfo) {
        nodeInfo.isExpand ^= true
        this.expandOrCollapseFolder(element, nodeInfo.isExpand)
    }

    fileLeftClicked(element, nodeInfo) {
        // TODO: folerView focus
        const newTab = this.tabBar.initTab(nodeInfo)
        if (newTab) {
            this.tabBar.insertTab(newTab, nodeInfo)
        }

        let rawFile = new XMLHttpRequest()
        rawFile.open("GET", nodeInfo.path, false)
        rawFile.onreadystatechange = function () {
            if (rawFile.readyState == 4) {
                if (rawFile.status == 200 || rawFile.status == 0) {
                    let plainText = rawFile.responseText;
                    // DEBUG: insert all the text into vditor
                    window.vditor.insertValue(plainText, true);
                }
            }
        }
        rawFile.send(null)
        
    }

    setListeners() {

        ipcRenderer.on('openFolder', (event, path, stat) => {
            this.isFolderOpened = true
            this.FolderTree.tree = this.FolderTree.createFolderTree(path, 0)
            this.FolderTree.treeList = this.FolderTree.getFolderTreeList(this.FolderTree.tree)

            folderTree.removeChild(emptyFolderTag)
            folderTree.appendChild(tree)
            this.displayFolderTree(this.FolderTree.tree)

            $('.node-text').on('click', { folderViewClass: this }, function (event) {
                let that = event.data.folderViewClass
                let nodeNum = this.parentNode.getAttribute('nodeNum')
                let nodeInfo = that.FolderTree.treeList[parseInt(nodeNum)]
                if (nodeInfo.isFolder) {
                    that.folderLeftClicked($(this), nodeInfo)
                } else { 
                    that.fileLeftClicked($(this), nodeInfo)
                }
            })
        })

        folderBtn.addEventListener('click', () => {
            if (this.isFileClicked == false) {
                this.isFileClicked = true
                this.isOutlineClicked = false
                this.folderBtnSelected(true)
            }
        })

        outlineBtn.addEventListener('click', () => {
            if (this.isOutlineClicked == false) {
                this.isOutlineClicked = true
                this.isFileClicked = false
                this.folderBtnSelected(false)
            }
        })

        resize.addEventListener("mousedown", (event) => {
            this.resizeX = event.x
            document.addEventListener("mousemove", this.resizeFolderView, false)
        }, false)

        document.addEventListener("mouseup", () => {
            document.removeEventListener("mousemove", this.resizeFolderView, false)
        }, false)
    }

    createfolderIconString(fileName) {
        return "<style>.node-text::before {content: url('assets/icons/" + fileName + "');display: inline-block;width: 10px;height: 10px;margin-left: 4px;margin-right: 4px;}</style>"
    }

    openNewFolder() {
        ipcRenderer.send('openNewFolder')
    }

    resizeFolderView(event) {
        if (event.x < 100)
            return
        let dx = this.resizeX - event.x
        this.resizeX = event.x
        /* new X has to be calculated first, than concatenates with "px", otherwise
           the string will be like newX = "1000+2px" and losing accuracy */
        let folderViewNewX = parseInt(getComputedStyle(folderView, '').width) - dx
        let mdViewNewX = parseInt(getComputedStyle(mdView, '').width) + dx
        folderView.style.width = folderViewNewX + "px"
        mdView.style.width = mdViewNewX + "px"
    }

    folderBtnSelected(isFolderSelected) {
        if (isFolderSelected) {
            folderBtn.style.color = '#65655F'
            folderBtn.style.fontWeight = 'bold'
            folderBtn.style.borderBottom = '2px solid #5b5b55'
            emptyFolderTag.innerHTML = 'open a folder'
            outlineBtn.style.color = '#9f9f95'
            outlineBtn.style.fontWeight = 'normal'
            outlineBtn.style.borderBottom = '2px solid transparent'

            folderView.appendChild(folderTree)
            emptyFolderTag.addEventListener('click', this.openNewFolder)
        } else {
            outlineBtn.style.color = '#65655F'
            outlineBtn.style.fontWeight = 'bold'
            outlineBtn.style.borderBottom = '2px solid #5b5b55'
            emptyFolderTag.innerHTML = 'outline is empty'
            folderBtn.style.color = '#9f9f95'
            folderBtn.style.fontWeight = 'normal'
            folderBtn.style.borderBottom = '2px solid transparent'

            folderView.removeChild(folderTree)
            emptyFolderTag.removeEventListener('click', this.openNewFolder)
        }
    }
}

new FolderViewModule()

module.exports = { FolderViewModule }
