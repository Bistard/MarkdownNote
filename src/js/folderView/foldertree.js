const { ipcRenderer } = require('electron')
const fs = require('fs')
const Path = require('path')

/**
 * @description the object is to store and maintain the data for each 
 * folder/tree/root.
 * 
 * @param {treeNode[]} nodes 
 * @param {boolean} isFolder 
 * @param {string} name 
 * @param {string} baseName 
 * @param {string} path 
 * @param {number} level 
 * @param {boolean} isExpand 
 * @param {string} plainText 
 */
class treeNode {
    constructor(nodes, 
                isFolder, 
                name, 
                baseName, 
                path, 
                level, 
                isExpand, 
                plainText) {
        Object.assign(this, {nodes, isFolder, name, baseName, path, level, isExpand, plainText})
    }
}

/**
 * @description FolderTreeModule is responsible for storing data for each node 
 * in the opened folder tree. Only deals with dada handling, searching and 
 * storing.
 */
class FolderTreeModule {
    
    constructor() {
        // TODO: reduce memory usage (.tree .treeList might overlap)
        this.tree = {}
        this.treeList = []
    }

    /**
     * @description Searches and creates a complete folder tree.
     * 
     * @param {string} path path to the folder/file
     * @param {number} lev represents the level of that folder
     * @returns {treeNode} the complete folder tree
     */
    createFolderTree(path, lev) {

        const baseName = Path.basename(path)
        if (fs.lstatSync(path).isDirectory()) {
            
            let name = baseName.replace(/_/g, ' ')
            const node = new treeNode({}, true, name, baseName, path, lev, false, '')
            
            const files = fs.readdirSync(path, {
                encoding: 'utf8',
                withFileTypes: false
            })

            files.forEach(file => {
                const tree = this.createFolderTree(Path.join(path, file), lev + 1)
                node.nodes[file] = tree
            })
            return node

        } else if (/\.md$/i.test(path)) {
            let name = baseName.replace(/_/g, ' ').replace(/\.md$/, '').trim()
            return new treeNode({}, false, name, baseName, path, lev, false, '')
        }
        
        // reaches if no suffix or not .md
        return new treeNode({}, false, baseName, baseName, path, lev, false, '')
    }

    /**
     * @description traversing and returns an array version of folder tree 
     * using pre-order.
     * 
     * @param {treeNode} tree 
     * @param {treeNode[]} list 
     * @returns {treeNode[]} an array of treeNode
     */
    getFolderTreeList(tree, list = []) {
        if (tree.isFolder) {
            list.push(tree)
			for (const [key, node] of Object.entries(tree.nodes)) {
				this.getFolderTreeList(node, list)
			}
		} else {
			list.push(tree)
		}
		return list
    }

}

module.exports = { FolderTreeModule }