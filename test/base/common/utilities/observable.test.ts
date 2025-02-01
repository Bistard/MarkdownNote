import * as assert from 'assert';
import { afterEach, beforeEach } from 'mocha';
import { deepCopy, mixin } from 'src/base/common/utilities/object';
import { IObservable, IObservableOptions, Observable, ObserveType, createDefaultObserver, observable, observe } from 'src/base/common/utilities/observable';

suite('Observable-test', function() {
    type TestObject = {
        bar: number;
        foo: () => string;
    };

    let ob: IObservable<TestObject>;
    let changes: Array<{ prevVal: any; newVal: any; }>;

    beforeEach(() => {
        const observedObject: TestObject = { 
            bar: 1, 
            foo: function() { return 'original'; } 
        };
        ob = new Observable(observedObject);
        changes = [];
    });

    afterEach(() => {
        ob.dispose();
    });

    test('Proxy returns expected initial values', function() {
        const proxy = ob.getProxy();
        assert.strictEqual(proxy.bar, 1);
        assert.strictEqual(proxy.foo(), 'original');
    });

    test('Observing property access (get operations)', function(done) {
        const proxy = ob.getProxy();
    
        // Register an observer for 'get' operations on 'bar'
        ob.on('get', 'bar', (currVal) => {
            changes.push({ prevVal: currVal, newVal: currVal });
            assert.strictEqual(currVal, 1);
            done();
        });
    
        const value = proxy.bar;
    
        assert.strictEqual(value, 1);
        assert.strictEqual(changes.length, 1);
    });

    test('Observing property changes', function(done) {
        const proxy = ob.getProxy();

        ob.on('set', 'bar', (prevVal, newVal) => {
            changes.push({ prevVal, newVal });
            assert.strictEqual(prevVal, 1);
            assert.strictEqual(newVal, 2);
            done();
        });

        proxy.bar = 2;
    });

    test('Observing foo calls', function(done) {
        const proxy = ob.getProxy();

        ob.on('call', 'foo', (ret) => {
            assert.strictEqual(ret, 'original');
            done();
        });

        proxy.foo();
    });
    
    test('Observing any calls', function(done) {
        const proxy = ob.getProxy();

        ob.on('call', null, (propKey, ret) => {
            assert.strictEqual(propKey, 'foo');
            assert.strictEqual(ret, 'original');
            done();
        });

        proxy.foo();
    });

    test('Observing for any changes on given ObserveType', function() {
        const ob = new Observable({ 
            bar: 1,
            foo: 'hello', 
        });
        const proxy = ob.getProxy();


        const changes: any[] = [];
        ob.on('set', null, (propKey, prevVal, newVal) => {
            changes.push([propKey, prevVal, newVal]);
        });

        proxy.bar = 2;
        proxy.foo = 'world';

        assert.strictEqual(changes.length, 2);
        assert.deepStrictEqual(changes[0], ['bar', 1, 2]);
        assert.deepStrictEqual(changes[1], ['foo', 'hello', 'world']);
    });

    test('Dispose removes all observers', function() {
        const proxy = ob.getProxy();

        ob.on('set', 'bar', (prevVal, newVal) => {
            changes.push({ prevVal, newVal });
        });

        ob.dispose();

        proxy.bar = 2; // Should not trigger the observer

        assert.strictEqual(changes.length, 0);
    });
});

suite('observable-test', () => {

    let history: { 
        className: string, 
        property: string, 
        action: ObserveType, 
        from: any, 
        to: any, 
        value: any, 
        ret: any, 
        args?: any[],
    }[] = [];
    
    const TEST_OBSERVER = createDefaultObserver(
        function testObserver(opts: IObservableOptions, message: string, ...param: any[]): void {
        
            const className: string = param[0]!;
            const property: string = param[1]!;
            const action: ObserveType = param[2]!;
            const params = param.slice(3);

            let from: any, to: any, value: any, args: any[] | undefined, ret: any;
            if (action === 'get') {
                value = params[0];
            } else if (action === 'set') {
                from = params[0];
                to = params[1];
            } else if (action === 'call') {
                ret = params[0];
                args = params[1];
            }
            
            const his: typeof history[0] = { className, property, action, from, to, value, ret, args };
            !value && delete his.value;
            !from && delete his.from;
            !to && delete his.to;
            !ret && delete his.ret;
            !args && delete his.args;
            history.push(his);
        }
    );

    const basicOpt: IObservableOptions = {
        observer: TEST_OBSERVER,
    };

    beforeEach(() => {
        history = [];
    });

    class PeopleSample {
        public name: string = 'Chris';
        public ages = {
            age: 18,
            grow() { return this.age++; }
        };
        public hello() { return 'world'; }
    }

    test('Observing simple property changes and access', () => {
        @observable(basicOpt)
        class People {
            @observe(['set', 'get'])
            public name: string = 'Chris';
        }

        const person = new People();

        person.name = 'Alex';     // Trigger 'set'
        const name = person.name; // Trigger 'get'

        assert.strictEqual(name, 'Alex');
        assert.strictEqual(history.length, 2);

        const base = { className: 'People', property: 'name' };
        
        assert.deepStrictEqual(history[0], mixin(deepCopy(base), { action: 'set', from: 'Chris', to: 'Alex' }, {}));
        assert.deepStrictEqual(history[1], mixin(deepCopy(base), { action: 'get', value: 'Alex' }, {}));
    });
    
    test('Duplicate observing doesn"t work', () => {
        @observable(basicOpt)
        class People {
            @observe(['set', 'set'])
            public name: string = 'Chris';
        }

        const person = new People();
        person.name = 'Alex';     // Trigger 'set'

        assert.strictEqual(history.length, 1);

        const base = { className: 'People', property: 'name' };
        assert.deepStrictEqual(history[0], mixin(deepCopy(base), { action: 'set', from: 'Chris', to: 'Alex' }, {}));
    });

    test('Non-decorated properties should not trigger observations', () => {
        @observable(basicOpt)
        class People {
            public name: string = 'Chris';
        }

        const person = new People();

        person.name = 'Alex';
        const name = person.name;

        assert.strictEqual(name, 'Alex');
        assert.strictEqual(history.length, 0); // NOT TRIGGER
    });

    test('Observing direct function call under the class', () => {
        @observable(basicOpt)
        class People {
            @observe(['call'])
            public hello(): string { return 'world'; }
            @observe(['call'])
            public echo(input: string): string { return input; }
        }

        const person = new People();
        person.hello();
        person.echo('again');

        assert.strictEqual(history.length, 2);
        const base = { className: 'People', action: 'call' };

        assert.deepStrictEqual(history[0], mixin(deepCopy(base), { property: 'hello', args: [], ret: 'world' }, {}));
        assert.deepStrictEqual(history[1], mixin(deepCopy(base), { property: 'echo', args: ['again'], ret: 'again' }, {}));
    });

    test('Non-decorated methods should not be observed', () => {
        @observable(basicOpt)
        class People {
            public hello(): string { return 'world'; }
            public echo(input: string): string { return input; }
        }

        const person = new People();
        person.hello();
        person.echo('again');

        assert.strictEqual(history.length, 0);
    });

    test('Observing "get" on direct property that is an object', () => {
        const innerAge = {
            age: 18,
        };
        
        @observable(basicOpt)
        class People {
            @observe(['get'])
            public ages = innerAge;
        }

        const person = new People();
        person.ages;
        person.ages.age;

        assert.strictEqual(history.length, 3);
        const base = { className: 'People', action: 'get' };
        
        // person.ages
        assert.deepStrictEqual(history[0], mixin(deepCopy(base), { property: 'ages', value: innerAge }, {}));
        
        // person.ages.age
        assert.deepStrictEqual(history[1], mixin(deepCopy(base), { property: 'ages', value: innerAge }, {}));
        assert.deepStrictEqual(history[2], mixin(deepCopy(base), { property: 'ages.age', value: 18 }, {}));
    });
    
    test('Observing "set" on direct property that is an object', () => {
        const innerAge = {
            age: 18,
        };
        
        @observable(basicOpt)
        class People {
            @observe(['set'])
            public ages = innerAge;
        }

        const person = new People();
        person.ages.age = 19;

        assert.strictEqual(history.length, 1);
        const base = { className: 'People', action: 'set' };
        
        assert.deepStrictEqual(history[0], mixin(deepCopy(base), { property: 'ages.age', from: 18, to: 19 }, {}));
    });
    
    test('Observing "set" and "get" on direct property that is an object', () => {
        const innerAge = {
            age: 18,
        };
        
        @observable(basicOpt)
        class People {
            @observe(['set', 'get'])
            public ages = innerAge;
        }

        const person = new People();
        person.ages.age = 19;

        assert.strictEqual(history.length, 2);
        const base = { className: 'People', };
        
        assert.deepStrictEqual(history[0], mixin(deepCopy(base), { action: 'get', property: 'ages', value: innerAge }, {}));
        assert.deepStrictEqual(history[1], mixin(deepCopy(base), { action: 'set', property: 'ages.age', from: 18, to: 19 }, {}));
    });
    
    test('"get" for direct object property with method, altering reference', () => {
        const innerAge = {
            grow() {}
        };
        
        @observable(basicOpt)
        class People {
            @observe(['get'])
            public ages = innerAge;
        }

        const person = new People();
        person.ages;

        assert.strictEqual(history.length, 1);

        /**
         * Since function from {@link Observable} will be wrapped, the history 
         * one is not the same as the original one.
         */
        assert.notDeepStrictEqual(history[0]?.value, innerAge);
    });

    function rmFn(obj: object) {
        return Object.entries(obj).reduce((acc, [key, value]) => {
            if (typeof value !== 'function') {
                acc[key] = value;
            }
            return acc;
        }, {});
    }

    test('Observing "call" on direct property that is an object', () => {
        const innerAge = {
            age: 18,
            grow() { return ++this.age; }
        };
        
        @observable(basicOpt)
        class People {
            @observe(['set', 'get', 'call'])
            public ages = innerAge;
        }

        const person = new People();
        person.ages.grow();

        {
            history[0]!['value'] = rmFn(history[0]?.value);
            history.splice(4); // delete reduntant history during rmFn
        }

        assert.strictEqual(history.length, 4);
        assert.deepStrictEqual(history[0], { className: 'People', action: 'get', property: 'ages', value: rmFn(innerAge) });
        assert.deepStrictEqual(history[1], { className: 'People', action: 'get', property: 'ages.age', value: 18 });
        assert.deepStrictEqual(history[2], { className: 'People', action: 'set', property: 'ages.age', from: 18, to: 19 });
        assert.deepStrictEqual(history[3], { className: 'People', action: 'call', property: 'ages.grow', ret:19, args: [] });
    });

    test('Observing "call" will ignore underscore function', () => {
        const opt = deepCopy(basicOpt);
        opt.ignoreUnderscores = true;

        @observable(opt)
        class People {
            @observe(['call'])
            public __grow() {}

            @observe(['call'])
            public inner = {
                __grow() {}
            };
        }

        const person = new People();
        person.__grow();
        person.inner.__grow();

        assert.strictEqual(history.length, 0);
    });
    
    test('Observing "call" will NOT ignore underscore function', () => {
        const opt = deepCopy(basicOpt);
        opt.ignoreUnderscores = false;

        @observable(opt)
        class People {
            @observe(['call'])
            public __grow() {}

            @observe(['call'])
            public inner = {
                __grow() {}
            };
        }

        const person = new People();
        person.__grow();
        person.inner.__grow();

        assert.strictEqual(history.length, 2);
        assert.deepStrictEqual(history[0], { className: 'People', action: 'call', property: '__grow', args: [] });
        assert.deepStrictEqual(history[1], { className: 'People', action: 'call', property: 'inner.__grow', args: [] });
    });
});