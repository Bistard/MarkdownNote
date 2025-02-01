import * as assert from 'assert';
import { deepCopy, deepFreeze, mixin, strictEquals } from 'src/base/common/utilities/object';
import { nullObject } from 'test/utils/helpers';

suite('object-test', () => {

    suite('mixin', () => {
        
        test('basics', () => {
            // no overwrite
            let destination: any = {};
            let source: any = {
                a: 1,
                b: 'b',
                c: undefined
            };
            mixin(destination, source, { overwrite: false });
            assert.deepStrictEqual(destination, source);
    
            // overwrite
            destination = {
                a: 2,
            };
            source = {
                a: 1,
                b: 'b',
                c: undefined
            };
            mixin(destination, source, { overwrite: true });
            assert.deepStrictEqual(destination, source);
    
            // complicated overwrite
            destination = {
                a: {
                    d: null,
                    e: {}
                },
                b: Symbol('a'),
                d: undefined
            };
            source = {
                a: {
                    d: 0,
                    e: undefined
                },
                b: 'b',
                c: undefined
            };
            mixin(destination, source, { overwrite: true });
            assert.deepStrictEqual(destination, mixin(source, { d: undefined }, {}));
        });

        test('should copy properties from source to destination', () => {
            const dest = { a: 1 };
            const src = { b: 2 };
            const result = mixin(dest, src, {});
            assert.deepStrictEqual(result, { a: 1, b: 2 });
        });

        test('should overwrite existing properties if overwrite is true', () => {
            const dest = { a: 1 };
            const src = { a: 2 };
            const result = mixin(dest, src, { overwrite: true });
            assert.deepStrictEqual(result, { a: 2 });
        });

        test('should not overwrite existing properties if overwrite is false', () => {
            const dest = { a: 1 };
            const src = { a: 2 };
            const result = mixin(dest, src, { overwrite: false });
            assert.deepStrictEqual(result, { a: 1 });
        });

        test('should ignore non-object source', () => {
            const dest = { a: 1 };
            const src = 2;
            const result = mixin(dest, src, {});
            assert.deepStrictEqual(result, dest);
        });

        test('should ignore non-object destination and return source', () => {
            const dest = 1;
            const src = { a: 2 };
            const result = mixin(dest, src, {});
            assert.deepStrictEqual(result, src);
        });

        test('should handle nested objects and overwrite by default', () => {
            const dest = { a: { b: 1 } };
            const src = { a: { b: 2 } };
            const result = mixin(dest, src, {});
            assert.deepStrictEqual(result, { a: { b: 2 } });
        });

        test('should handle nested objects and not overwrite if specified', () => {
            const dest = { a: { b: 1 } };
            const src = { a: { b: 2 } };
            const result = mixin(dest, src, { overwrite: false });
            assert.deepStrictEqual(result, { a: { b: 1 } });
        });

        test('should prevent prototype pollution', () => {
            const dest = {};
            const src = JSON.parse('{"__proto__": {"polluted": "yes"}}');
            mixin(dest, src, {});
            assert.strictEqual(({})['polluted'], undefined);
        });

        test('should ignore object overwrites with certain constructors', () => {
            class TestObject {
                constructor(public readonly value: number) {}
            }
            const oldObject = new TestObject(1);
            const newObject = new TestObject(2);
            const dest = { target: oldObject };
            const src = { target: newObject };
            mixin(dest, src, { ignored: [TestObject], overwrite: true });
            assert.strictEqual(dest.target, newObject);
            assert.strictEqual(oldObject.value, 1);
            assert.strictEqual(newObject.value, 2);
        });
    });
    
    test('deepCopy', () => {
        const getObj = () => {
            return {
                a: {
                    d: null,
                    e: {},
                    f: {
                        g: 32,
                    },
                    h: 'hello'
                },
                d: undefined
            } as any;
        };

        const getArr = () => {
            return [1, 2, [3, 4, [5, [6, [], [7, [8]]]]], 9];
        };
        
        const obj = getObj();
        const copy1 = deepCopy(obj);
        assert.deepStrictEqual(copy1, obj);
        delete obj['a'];
        assert.deepStrictEqual(copy1, getObj());

        const arr = getArr();
        const copy2 = deepCopy(arr);
        assert.deepStrictEqual(copy2, arr);
        arr.length = 0;
        assert.deepStrictEqual(copy2, getArr());
    });

    test('deepFreeze', () => {
        const obj = {
            prop1: 5,
            prop2: true,
            prop3: 'hello',
            prop4: ['world', 3.14],
        };
        
        deepFreeze(obj);
        assert.throws(() => obj.prop1 = 4 );
        assert.throws(() => obj.prop2 = false );
        assert.throws(() => obj.prop3 = 'world' );
        assert.throws(() => obj.prop4[0] = 'hello' );
        assert.throws(() => obj.prop4[1] = 2.7 );
    });

    test('nullObject', () => {
        const iCanDoWhateverIWant = nullObject();
        iCanDoWhateverIWant.dao(124, 'asdq').IDK().forEach(() => 'bulabula');
        delete iCanDoWhateverIWant.hello;
        iCanDoWhateverIWant.world = 'string';
        iCanDoWhateverIWant.world = () => iCanDoWhateverIWant;
    });

    test('strictEquals', () => {
        const obj1 = { a: 1, b: { c: 2 }};
        const obj2 = { a: 1, b: { c: 2 }};
        const obj3 = { a: 1, b: { c: 3 }};

        assert.ok(strictEquals(obj1, obj1), 'strictEquals(obj1, obj1)');
        assert.ok(strictEquals(obj1, obj2), 'strictEquals(obj1, obj2)');
        assert.ok(!strictEquals(obj1, obj3), 'strictEquals(obj1, obj3)');
        assert.ok(!strictEquals(obj2, obj3), 'strictEquals(obj2, obj3)');
        assert.ok(!strictEquals(0, obj3), 'strictEquals(0, obj3)');
        
        assert.ok(!strictEquals(false, true), 'strictEquals(false, true)');
        assert.ok(strictEquals(true, true), 'strictEquals(true, true)');
        assert.ok(strictEquals(false, false), 'strictEquals(false, false)');

        assert.ok(strictEquals(0, 0), 'strictEquals(0, 0)');
        assert.ok(!strictEquals(0, undefined), 'strictEquals(0, undefined)');
        assert.ok(!strictEquals(0, 1), 'strictEquals(0, 1)');
        assert.ok(!strictEquals(-1, 1), '(-1, 1)');
        assert.ok(strictEquals(114514, 114514), 'strictEquals(114514, 114514)');

        assert.ok(!strictEquals(5, undefined), 'strictEquals(5, undefined)');
        assert.ok(!strictEquals(null, undefined), 'strictEquals(null, undefined)');
        assert.ok(strictEquals(null, null), 'strictEquals(null, null)');
        assert.ok(strictEquals(undefined, undefined), 'strictEquals(undefined, undefined)');
        assert.ok(strictEquals('hello', 'hello'), 'hello hello');
        assert.ok(strictEquals([], []), 'ok(strictEquals([], [])');
        assert.ok(!strictEquals([1], []), '([1], [])');
        assert.ok(strictEquals([1], [1]), '], [1])');
        assert.ok(strictEquals([undefined], [undefined]), '], [undefined])');
        assert.ok(!strictEquals([undefined], [undefined, undefined]), '[undefined, undefined])');
    });
});