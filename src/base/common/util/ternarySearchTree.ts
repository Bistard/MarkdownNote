import { IIterable } from "src/base/common/util/iterable";
import { Random } from "src/base/common/util/random";
import { isNonNullable } from "src/base/common/util/type";

const enum Dir {
    Left = -1,
    Mid = 0,
    Right = 1
}

export interface IKeyIterator<K> {

    /**
     * @description Modify the iterator to point to the next item in the value.
     */
    next(): void;

    /**
     * @description Check if the key iterator has a next item in the key.
     */
    hasNext(): boolean;
    
    /**
     * @description Reset key value of the key iterator.
     */
    reset(value: K): this;

    /**
     * @description Compare the `input` with the item currently pointed by
     * the iterator.
     * @returns negative if input is smaller, postive if current item is
     * smaller, 0 if equal.
     */
    cmp(input: string): number;

    /**
     * @description Return the current item the iterator points to.
     */
    currItem(): string;
}

export class StringIterator implements IKeyIterator<string> {

    private _value: string;
    private _pos: number;

    constructor() {
        this._value = '';
        this._pos = 0;
    }

    public next(): void {
        this._pos += 1;
    }

    public hasNext(): boolean {
        return this._pos < (this._value.length - 1)
    }

    public reset(value: string): this {
        this._value = value;
        this._pos = 0;
        return this;
    }

    public cmp(input: string): number {
        const inputChar = input.charCodeAt(0);
        const iterChar = this._value.charCodeAt(this._pos);
        return inputChar - iterChar;
    }

    public currItem(): string {
        return this._value[this._pos]!;
    }
}

export interface ITernarySearchTree<K, V> extends IIterable<[K, V]> {
    
    /**
     * @description Clear the ternary search tree.
     * @complexity O(1)
     */
    clear(): void;

    /**
     * @description Fill the ternary search tree with an array of (key, value) 
     * pairs.
     * @param values An array of (key, value) pairs.
     * @complexity O(mlogn), m: length of {@link values}
     *                       n: number of nodes
     */
    fill(values: readonly [K, V][]): void;

    /**
     * @description Insert `value` with `key` as search key.
     * @param value The value to be inserted.
     * @param key The key can be used to reference the value.
     * @complexity O(logn + k), n: number of nodes
     *                          k: length of key
     */
    set(key: K, value: V): V | undefined;

    /**
     * @description Get the value in the tree that corresponds to the key.
     * @param key A key to search its corresponding value.
     * @returns Return the value if searched, otherwise return undefined.
     * @complexity O(logn + k), n: number of nodes
     *                          k: length of key
     */
    get(key: K): V | undefined;

    /**
     * @description Return if the tree constains a value that corresponds to
     * `key`.
     * @param key A key to search its corresponding value.
     * @complexity O(logn + k), n: number of nodes
     *                          k: length of key
     */
    has(key: K): boolean;

    /**
     * @description Delete the value corresponds to the `key` in the tree.
     * @param key A key to search its corresponding value.
     * @complexity O(logn + k), n: number of nodes
     *                          k: length of key
     */
    delete(key: K): void;

    /**
     * @description Delete any values with given key that which contains the 
     * key as the superstring.
     * @param key A key to search its corresponding value.
     * @complexity O(logn + k), n: number of nodes
     *                          k: length of key
     * 
     * @example
     * Given two string 'cat' and 'cats' stored in the tree with their values 
     * equals to keys. 
     * * deleteSuperStr('cat') will delete 'cats' but not deleting 'cat' itself. 
     */
    deleteSuperStr(key: K): void;
    
    /**
     * @description Find the longest substring of the `key` that has a value.
     * @param key A key to search its corresponding value.
     * @complexity O(logn + k), n: number of nodes
     *                          k: length of key
     * 
     * @example
     * Given two string 'cat' and 'cats' stored in the tree with their values 
     * equals to keys:
     * * findSubtr('cat') returns 'cat'
     * * findSubstr('cats') returns 'cats'
     * 
     * If 'cats' is input key that does not have a value:
     * * findSubstr('cats') returns cat.
     */
    findSubtr(key: K): V | undefined;

    /**
     * @description Iterate the whole tree with in-order.
     * @param callback The function to visit every key-value pair.
     */
    forEach(callback: (value: V, key: K) => any): void;
}

/**
 * @internal
 */
export class TernarySearchTreeNode<K, V> {
    public height: number = 1;

    // current segment of the key, assigned by key[pos]
    public segment: string;

    // the entire key
    public key: K | undefined;

    public value: V | undefined;
    public left: TernarySearchTreeNode<K, V> | undefined;
    public mid: TernarySearchTreeNode<K, V> | undefined;
    public right: TernarySearchTreeNode<K, V> | undefined;

    constructor(segment: string) {
        this.segment = segment;
    }

    // AVL rotate

    /**
     * @description AVL-rotate the subtree left and update height.
     * @assert Requires `node.right` to be non-nullity.
     */
    public rotateLeft(): TernarySearchTreeNode<K, V> {
        const tmp = this.right!;
        this.right = tmp.left;
        tmp.left = this;
        this.updateNodeHeight();
        tmp.updateNodeHeight();
        return tmp;
    }

    /**
     * @description AVL-rotate the subtree right and update height.
     * @assert Requires `node.left` to be non-nullity.
     */
    public rotateRight(): TernarySearchTreeNode<K, V> {
        const tmp = this.left!;
        this.left = tmp.right;
        tmp.right = this;
        this.updateNodeHeight();
        tmp.updateNodeHeight();
        return tmp;
    }

    public updateNodeHeight(): void {
        this.height = 1 + Math.max(this.leftHeight, this.rightHeight);
    }

    public balanceFactor(): number {
        return this.rightHeight - this.leftHeight;
    }

    get leftHeight(): number {
        return this.left?.height ?? 0;
    }

    get rightHeight(): number {
        return this.right?.height ?? 0;
    }
}

/**
 * @namespace CreateTernarySearchTree includes a series of functions that 
 * create a ternary search tree structure for different types of keys.
 * 
 * Currently, it supports keys types: string, URI, and path(string).
 *  
 * Note: All functions require a key iterator to generate the ternary search
 * Tree.
 */
export namespace CreateTernarySearchTree {
    export function forStrings<E>(): TernarySearchTree<string, E> {
        return new TernarySearchTree<string, E>(new StringIterator());
    }

    // TODO: other iters
}

/**
 * @class An AVL-balanced prefix tree(trie) structure that supports fast insert, 
 * search and delete. It is iterator-based which defines the how to iterate over a 
 * key.
 * 
 * @note The key type is restricted by the providing iterator.
 * @note The value type cannot be nullity.
 */
export class TernarySearchTree<K, V extends NonNullable<any>> implements ITernarySearchTree<K, V> {

    // [fields]

    private _root: TernarySearchTreeNode<K, V> | undefined;
    private _iter: IKeyIterator<K>;

    // [constructor]
    
    constructor(keyIter: IKeyIterator<K>) {
        this._iter = keyIter;
    }

    // [public methods]

    public clear(): void {
        this._root = undefined;
    }

    public fill(values: readonly [K, V][]): void {
        const arr = values.slice(0);
        Random.shuffle(arr);
        for (const entry of arr) {
            this.set(entry[0], entry[1]);
        }
    }

    public set(key: K, value: V): V | undefined {
        const iter = this._iter.reset(key);
        let node: TernarySearchTreeNode<K, V>;

        if (!this._root) {
            this._root = new TernarySearchTreeNode<K, V>(iter.currItem());

        }

        // stores directions take by the path nodes to reach the target node
        const path: [Dir, TernarySearchTreeNode<K, V>][] = [];

        node = this._root;

        // find(or create based on the key) the target node to insert the value
        while (true) {

            // compare index
            const val = iter.cmp(node.segment);
            if (val > 0) {
                // current node larger than target node, go to left
                if (!node.left) {
                    node.left = new TernarySearchTreeNode<K, V>(iter.currItem());
                }
                path.push([Dir.Left, node]);
                node = node.left;

            } else if (val < 0) {
                // current node smaller than target node, go to right
                if (!node.right) {
                    node.right = new TernarySearchTreeNode<K, V>(iter.currItem());                
                }
                path.push([Dir.Right, node]);
                node = node.right;

            } else if (iter.hasNext()) {
                iter.next();
                if (!node.mid) {
                    node.mid = new TernarySearchTreeNode<K, V>(iter.currItem());                
                }
                path.push([Dir.Mid, node])
                node = node.mid;
            } else {
                break;
            }
        }
        
        // store the old value, could be undefined
        const oldVal = node.value;
        node.value = value;
        node.key = key;

        // AVL balance
        this._avlBalance(path);

        return oldVal;
    }

    public get(key: K): V | undefined {
        const node = this._findNode(key);
        return node?.value;
    }

    public has(key: K): boolean {
        const node = this._findNode(key);
        return (node?.value === undefined);
    }

    public delete(key: K): void {
        this._delete(key, false);
    }
 
     // delete any superStr that has key as a substring
    public deleteSuperStr(key: K): void {
         this._delete(key, true);
    }
 
    public findSubtr(key: K): V | undefined {
        const iter = this._iter.reset(key);
        let node =  this._root;
        let candidate: V | undefined = undefined;

        while (node) {
            const val = iter.cmp(node.segment);
            if (val > 0) {
                node = node.left;
            } else if (val < 0) {
                node = node.right;
            } else if (iter.hasNext()) {
                iter.next();
                candidate = node.value ?? candidate;
                node = node.mid;
            } else {
                break;
            }
        }
        if (node?.value) {
            return node.value;
        }
        return candidate;
     }
 
    public forEach(callback: (value: V, key: K) => any): void {
        for (const [key, value] of this) {
            callback(value, key);
        }
    }
 
    *[Symbol.iterator](): IterableIterator<[K, V]> {
        yield* this._nodeIter(this._root);
    }
    
    public getRoot() {
        return this._root;
    }
    // [private methods]

    private _findNode(key: K, path?: [Dir, TernarySearchTreeNode<K, V>][]): TernarySearchTreeNode<K, V> | undefined {
        const iter = this._iter.reset(key);
        let node =  this._root;

        while (node) {
            const val = iter.cmp(node.segment);
            if (val > 0) {
                node = node.left;
            } else if (val < 0) {
                node = node.right;
            } else if (iter.hasNext()) {
                iter.next();
                node = node.mid;
            } else {
                break;
            }
        }

        return node;
    }

    private _delete(key: K, superStr: boolean): void {
        const path: [Dir, TernarySearchTreeNode<K, V>][] = [];
        const iter = this._iter.reset(key);
        let node = this._root;

        while (node) {
            const val = iter.cmp(node.segment);
            if (val > 0) {
                path.push([Dir.Left, node]);
                node = node.left;
            } else if (val < 0) {
                path.push([Dir.Right, node]);
                node = node.right;
            } else if (iter.hasNext()) {
                path.push([Dir.Mid, node]);
                node = node.mid;
                iter.next();
            } else {
                break;
            }
        }

        if (!node) {
            // node is not found
            return;
        }

        // delete all super string
        if (superStr) {
            node.mid = undefined;
            node.left =  undefined;
            node.right = undefined;
            node.height = 1;
        } else {
            node.value = undefined;
            node.key = undefined;
        }

        // if node segment is not a part of any string
        if (!node.mid && !node.value) {
            this._bstRemoveNode(node, path);
        }

        // AVL balance
        this._avlBalance(path);
    }
    
    private _avlBalance(path: [Dir, TernarySearchTreeNode<K, V>][]): void {
        // bottom-up update height and AVL balance
        for (let i = path.length - 1; i >= 0; i--) {
            const node = path[i]![1]!;
            
            node.updateNodeHeight();
            const bf = node.balanceFactor();

                if (bf < -1 || bf > 1) {

                    // unbalanced
                    const d1 = path[i]![0];
                    let node1 = path[i]![1];
                    const d2 = path[i + 1]![0];
                    let node2 = path[i + 1]![1];

                    if (d1 == Dir.Left && d2 == Dir.Left) {
                        // left heavy, rotate right
                        node1 = path[i]![1] = node1.rotateRight();
                    } else if (d1 == Dir.Right && d2 == Dir.Right) {
                        // right heavy, rotate left
                        node1 = path[i]![1] = node1.rotateLeft();
                    } else if (d1 == Dir.Right && d2 == Dir.Left) {
                        node1.right = node2.rotateRight();
                        node1 = path[i]![1] = node1.rotateLeft();
                    } else { // d1 == Dir.Left && d2 == Dir.Right
                        node1.left = node2.rotateLeft();
                        node1 = path[i]![1] = node1.rotateRight();
                    }

                    // correct the parent of node1
                if (i > 0) {
                    switch(path[i]![0]) {
                        case Dir.Left:
                            path[i - 1]![1].left = node1;
                            break;
                        case Dir.Right:
                            path[i - 1]![1].right = node1;
                            break;
                        case Dir.Mid:
                            path[i - 1]![1].mid = node1;
                            break;
                    }
                } else {
                    this._root = node1;
                }
            }
        }
    }

    private _leftest(node: TernarySearchTreeNode<K, V>): TernarySearchTreeNode<K, V> {
        while (node.left) {
            node = node.left;
        }
        return node;
    }

    private _bstRemoveNode(node: TernarySearchTreeNode<K, V>, path: [Dir, TernarySearchTreeNode<K, V>][]): void {
        if (node.left && node.right) {
            const leftest = this._leftest(node.right);
            if (leftest) {
                const { key, value, segment } = leftest;
                this._delete(leftest.key!, false);
                node.key = key;
                node.value = value;
                node.segment = segment;
            }
        } else {
            // empty or only left\right
            const child = node.left ?? node.right;
            if (path.length > 0) {
                const [dir, parent] =  path[path.length - 1]!;
                switch(dir) {
                    case Dir.Left:
                        parent.left = child;
                        break;
                    case Dir.Mid:
                        parent.mid = child;
                        break;
                    case Dir.Right:
                        parent.right = child;
                        break;
                }
            } else {
                // no node is left
                this._root = child;
            }
        }
    }

    private _nodeIter(node: TernarySearchTreeNode<K, V> | undefined): IterableIterator<[K, V]> {
        const nodeArr: [K, V][] = [];
        this._dfsNodes(node, nodeArr);
        return nodeArr[Symbol.iterator]();
    }

    private _dfsNodes(node: TernarySearchTreeNode<K, V> | undefined, nodeArr: [K, V][]): void {
        if (!node) {
            return;
        }

        if (node.left) {
            this._dfsNodes(node.left, nodeArr);
        }

        if (isNonNullable(node.value)) {
            nodeArr.push([node.key!, node.value]);
        }

        if (node.mid) {
            this._dfsNodes(node.mid, nodeArr);
        }

        if (node.right) {
            this._dfsNodes(node.right, nodeArr);
        }
    }
}