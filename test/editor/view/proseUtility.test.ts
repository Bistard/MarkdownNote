import * as assert from 'assert';
import { ProseTools } from 'src/editor/common/proseUtility';
import { ProseUtilsTest } from 'test/editor/view/editorHelpers';

const { doc, p, image, blockquote, text } = ProseUtilsTest.defaultNodes;

suite('proseUtility-test', () => {

    /**
     * 0   1 2 3 4    5
     *  <p> O n e </p>
     */
    test('getDocumentSize 1', () => {
        const { state, view } = ProseUtilsTest.buildEditor(doc(p('One')));
        assert.strictEqual(ProseTools.Node.getDocumentSize(state), 5);
        view.destroy();
    });
    
    /**
     * 0   1 2 3 4    5            6   7 8 9 10     11    12             13
     *  <p> O n e </p> <blockquote> <p> T w o  <img>  </p>  </blockquote>
     */
    test('getDocumentSize 2', () => {
        const { state, view } = ProseUtilsTest.buildEditor(doc(
            p('One'),
            blockquote(
                p('Two', image())
            )
        ));
        
        assert.strictEqual(ProseTools.Node.getDocumentSize(state), 13);
        
        view.destroy();
    });

    /**
     * 0   1 2 3 4    5
     *  <p> O n e </p>
     */
    test('getNodeAt & getNodeSize', () => {
        const { state, view } = ProseUtilsTest.buildEditor(doc(p('One')));
        assert.strictEqual(ProseTools.Node.getDocumentSize(state), 5);

        const node = ProseTools.Position.getNodeAt(state, 1);

        assert.strictEqual(node.type.name, 'paragraph'); // type name
        assert.strictEqual(ProseTools.Node.getNodeSize(node), 5); // size of 'p'

        view.destroy();
    });

    test('isTextBlock for paragraph and blockquote', () => {
        const { state, view } = ProseUtilsTest.buildEditor(doc(p('Text'), blockquote(p())));
        const paraNode = ProseTools.Position.getNodeAt(state, 1);
        const quoteNode = ProseTools.Position.getNodeAt(state, 6);
        
        assert.strictEqual(ProseTools.Node.isTextBlock(paraNode), true);
        assert.strictEqual(ProseTools.Node.isTextBlock(quoteNode), false);
        view.destroy();
    });

    suite('Cursor namespace', () => {
        test('isCursor detects empty selection', () => {
            const { state, view } = ProseUtilsTest.buildEditor(doc(p('Text')));
            assert.strictEqual(ProseTools.Cursor.isCursor(state.selection), true);
            view.destroy();
        });
    
        test('isOnEmpty detects empty textblock', () => {
            const { state, view } = ProseUtilsTest.buildEditor(doc(p()));
            const cursor = ProseTools.Cursor.getPosition(state.selection as any);
            assert.strictEqual(ProseTools.Cursor.isOnEmpty(state.selection as any), true);
            view.destroy();
        });
    });

    suite('Text namespace', () => {
        test('getWordBound detects word boundaries', () => {
            /**
             * 0   1 2 3 4 5 6    7
             *  <p> H e l l o </p>
             */
            const { state, view } = ProseUtilsTest.buildEditor(doc(p('Hello')));
            const pos = ProseTools.Position.resolve(state, 3); // 在字母'l'处
            const bound = ProseTools.Text.getWordBound(pos);
            
            assert.deepStrictEqual(bound, { from: 1, to: 6 });
            view.destroy();
        });
    });

    suite('Position namespace', () => {
        // todo
    });
});

suite('EditorResolvedPosition', () => {
    
    /**
     * 0   1 2 3 4    5            6   7 8 9 10     11    12             13
     *  <p> O n e </p> <blockquote> <p> T w o  <img>  </p>  </blockquote>
     */
    test('getCurrNode && getParentNodeAt', () => {
        const { state, view } = ProseUtilsTest.buildEditor(doc(
            p('One'),
            blockquote(
                p('Two', image())
            )
        ));
        
        assert.strictEqual(ProseTools.Node.getDocumentSize(state), 13);
        const pos = ProseTools.Position.resolve(state, 7);
        
        assert.strictEqual(pos.getCurrNode().type.name, 'paragraph');
        assert.strictEqual(pos.getParentNodeAt(pos.depth)!.type.name, 'paragraph');
        
        assert.strictEqual(pos.getParentNodeAt(0)!.type.name, 'doc');
        assert.strictEqual(pos.getParentNodeAt(1)!.type.name, 'blockquote');
        assert.strictEqual(pos.getParentNodeAt(-1)!.type.name, 'blockquote');
        
        assert.strictEqual(pos.getParentNodeAt(2)!.type.name, 'paragraph');
        assert.strictEqual(pos.getParentNodeAt(3), undefined);
        assert.strictEqual(pos.getParentNodeAt(-3), undefined);

        view.destroy();
    });
});