import * as assert from 'assert';
import { IDisposable } from 'src/base/common/dispose';
import { ErrorHandler } from 'src/base/common/error';
import { AsyncEmitter, DelayableEmitter, Emitter, Event, IEmitterOptions, PauseableEmitter, RelayEmitter, SignalEmitter } from 'src/base/common/event';
import { Blocker, repeat } from 'src/base/common/utilities/async';
import { FakeAsync } from 'test/utils/fakeAsync';

suite('event-test', () => {

    suite('Emitter - basic', () => {
        test('should add a listener and trigger it with fire()', () => {
            const emitter = new Emitter<number>();
            let receivedEvent = 0;
            const listener = emitter.registerListener(event => receivedEvent = event);
    
            emitter.fire(42);
            assert.strictEqual(receivedEvent, 42);
    
            listener.dispose();
        });
    
        test('should dispose a listener properly', () => {
            const emitter = new Emitter<number>();
            let receivedEvent = 0;
            const listener = emitter.registerListener(event => receivedEvent = event);
    
            listener.dispose();
            emitter.fire(42);
            assert.strictEqual(receivedEvent, 0);
        });
    
        test('should invoke onFirstListenerAdd and onFirstListenerDidAdd callbacks', () => {
            let firstAddCalled = false;
            let firstDidAddCalled = false;
            const options: IEmitterOptions = {
                onFirstListenerAdd: () => firstAddCalled = true,
                onFirstListenerDidAdd: () => firstDidAddCalled = true,
            };
            const emitter = new Emitter<number>(options);
    
            const listener = emitter.registerListener(() => {});
            assert.strictEqual(firstAddCalled, true);
            assert.strictEqual(firstDidAddCalled, true);
    
            listener.dispose();
        });
    
        test('should invoke onListenerWillAdd and onListenerDidAdd for each listener', () => {
            let willAddCalled = 0;
            let didAddCalled = 0;
            const options: IEmitterOptions = {
                onListenerWillAdd: () => willAddCalled++,
                onListenerDidAdd: () => didAddCalled++,
            };
            const emitter = new Emitter<number>(options);
    
            const listener1 = emitter.registerListener(() => {});
            const listener2 = emitter.registerListener(() => {});
            assert.strictEqual(willAddCalled, 2);
            assert.strictEqual(didAddCalled, 2);
    
            listener1.dispose();
            listener2.dispose();
        });
    
        test('should invoke onListenerWillRemove and onListenerDidRemove callbacks', () => {
            let willRemoveCalled = 0;
            let didRemoveCalled = 0;
            const options: IEmitterOptions = {
                onListenerWillRemove: () => willRemoveCalled++,
                onListenerDidRemove: () => didRemoveCalled++,
            };
            const emitter = new Emitter<number>(options);
    
            const listener = emitter.registerListener(() => {});
            listener.dispose();
            assert.strictEqual(willRemoveCalled, 1);
            assert.strictEqual(didRemoveCalled, 1);
        });
    
        test('should invoke onLastListenerDidRemove when the last listener is removed', () => {
            let lastRemoveCalled = false;
            const options: IEmitterOptions = {
                onLastListenerDidRemove: () => lastRemoveCalled = true,
            };
            const emitter = new Emitter<number>(options);
    
            const listener = emitter.registerListener(() => {});
            listener.dispose();
            assert.strictEqual(lastRemoveCalled, true);
        });
    
        test('should handle listener errors with onListenerError callback', () => {
            let errorHandled = false;
            const options: IEmitterOptions = {
                onListenerError: () => errorHandled = true,
            };
            const emitter = new Emitter<number>(options);
    
            emitter.registerListener(() => { throw new Error('Listener error'); });
            emitter.fire(42);
            assert.strictEqual(errorHandled, true);
        });
    
        test('should dispose the emitter and prevent further listeners or events', () => {
            const emitter = new Emitter<number>();
            emitter.dispose();
    
            assert.strictEqual(emitter.isDisposed(), true);
            assert.strictEqual(emitter.hasListeners(), false);
    
            assert.throws(() => {
                emitter.registerListener(() => {});
            });
        });
    
        test('should verify hasListeners reflects correct listener count', () => {
            const emitter = new Emitter<number>();
            const listener1 = emitter.registerListener(() => {});
            const listener2 = emitter.registerListener(() => {});
    
            assert.strictEqual(emitter.hasListeners(), true);
    
            listener1.dispose();
            listener2.dispose();
    
            assert.strictEqual(emitter.hasListeners(), false);
        });
    
        test('should clear all listeners on dispose()', () => {
            const emitter = new Emitter<number>();
            emitter.registerListener(() => {});
            emitter.registerListener(() => {});
    
            assert.strictEqual(emitter.hasListeners(), true);
            emitter.dispose();
            assert.strictEqual(emitter.hasListeners(), false);
        });

        test('should call onListenerRun before each listener is triggered by fire()', () => {
            let onListenerRunCalled = 0;
            const options: IEmitterOptions = {
                onListenerRun: () => onListenerRunCalled++,
            };
            const emitter = new Emitter<number>(options);
    
            emitter.registerListener(() => {});
            emitter.registerListener(() => {});
    
            emitter.fire(42);
            assert.strictEqual(onListenerRunCalled, 2);
        });
    
        test('should call onListenerDidRun after each listener is triggered by fire()', () => {
            let onListenerDidRunCalled = 0;
            const options: IEmitterOptions = {
                onListenerDidRun: () => onListenerDidRunCalled++,
            };
            const emitter = new Emitter<number>(options);
    
            emitter.registerListener(() => {});
            emitter.registerListener(() => {});
    
            emitter.fire(42);
            assert.strictEqual(onListenerDidRunCalled, 2);
        });
    
        test('should call both onListenerRun and onListenerDidRun for each listener in correct order', () => {
            const calls: string[] = [];
            const options: IEmitterOptions = {
                onListenerRun: () => calls.push('onListenerRun'),
                onListenerDidRun: () => calls.push('onListenerDidRun'),
            };
            const emitter = new Emitter<number>(options);
    
            emitter.registerListener(() => {});
            emitter.registerListener(() => {});
            
            emitter.fire(42);
    
            assert.deepStrictEqual(calls, [
                'onListenerRun', 'onListenerDidRun',
                'onListenerRun', 'onListenerDidRun'
            ]);
        });

        test('should call onFire before firing an event', () => {
            let onFireCalled = false;
            const options: IEmitterOptions = {
                onFire: () => onFireCalled = true,
            };
            const emitter = new Emitter<number>(options);
    
            emitter.registerListener(() => {});
            emitter.fire(42);
            assert.strictEqual(onFireCalled, true);
        });
    
        test('should call onDidFire after firing an event', () => {
            let onDidFireCalled = false;
            const options: IEmitterOptions = {
                onDidFire: () => onDidFireCalled = true,
            };
            const emitter = new Emitter<number>(options);
    
            emitter.registerListener(() => {});
            emitter.fire(42);
            assert.strictEqual(onDidFireCalled, true);
        });
    
        test('should call onFire and onDidFire in correct order', () => {
            const callOrder: string[] = [];
            const options: IEmitterOptions = {
                onFire: () => callOrder.push('onFire'),
                onDidFire: () => callOrder.push('onDidFire'),
            };
            const emitter = new Emitter<number>(options);
    
            emitter.registerListener(() => callOrder.push('listener'));
            emitter.fire(42);
            
            assert.deepStrictEqual(callOrder, ['onFire', 'listener', 'onDidFire']);
        });
    
        test('should call onFire and onDidFire even if no listeners are registered', () => {
            let onFireCalled = false;
            let onDidFireCalled = false;
            const options: IEmitterOptions = {
                onFire: () => onFireCalled = true,
                onDidFire: () => onDidFireCalled = true,
            };
            const emitter = new Emitter<number>(options);
    
            emitter.fire(42);
            assert.strictEqual(onFireCalled, true);
            assert.strictEqual(onDidFireCalled, true);
        });
    
        test('should call onFire once per fire call', () => {
            let onFireCount = 0;
            const options: IEmitterOptions = {
                onFire: () => onFireCount++,
            };
            const emitter = new Emitter<number>(options);
    
            emitter.registerListener(() => {});
            emitter.fire(1);
            emitter.fire(2);
    
            assert.strictEqual(onFireCount, 2);
        });
    
        test('should call onDidFire once per fire call', () => {
            let onDidFireCount = 0;
            const options: IEmitterOptions = {
                onDidFire: () => onDidFireCount++,
            };
            const emitter = new Emitter<number>(options);
    
            emitter.registerListener(() => {});
            emitter.fire(1);
            emitter.fire(2);
    
            assert.strictEqual(onDidFireCount, 2);
        });
    
        test('should handle onFire and onDidFire even if listener throws an error', () => {
            let onFireCalled = false;
            let onDidFireCalled = false;
            const options: IEmitterOptions = {
                onFire: () => onFireCalled = true,
                onDidFire: () => onDidFireCalled = true,
                onListenerError: () => {}, // Handle errors to avoid breaking the test
            };
            const emitter = new Emitter<number>(options);
    
            emitter.registerListener(() => { throw new Error('Listener error'); });
            emitter.fire(42);
    
            assert.strictEqual(onFireCalled, true);
            assert.strictEqual(onDidFireCalled, true);
        });
    
        test('should not call onDidFire if onFire fails', () => {
            let onFireCalled = false;
            let onDidFireCalled = false;
            const options: IEmitterOptions = {
                onFire: () => { onFireCalled = true; throw new Error('onFire error'); },
                onDidFire: () => onDidFireCalled = true,
                onListenerError: () => {}, // Suppress error handling in test
            };
            const emitter = new Emitter<number>(options);
    
            emitter.registerListener(() => {});
            assert.throws(() => emitter.fire(42));
            assert.strictEqual(onFireCalled, true);
            assert.strictEqual(onDidFireCalled, false);
        });
    });
    
    test('emitter - this object replace', () => {

        let name!: string;

        class NameClass {
            constructor(public name: string) {}
            public getName(): void { name = this.name; }
        }

        const emitter = new Emitter<void>();

        const object = new NameClass('chris');
        const thisObject = new NameClass('replaced');

        const registration1 = emitter.registerListener(object.getName, undefined, thisObject);

        emitter.fire();

        assert.strictEqual(name, 'replaced');
    });

    test('emitter - dispose listener', () => {
        let counter = 0;
        const callback = (e: undefined) => {
            counter++;
        };

        const emitter = new Emitter<undefined>();

        const registration1 = emitter.registerListener(callback);
        
        emitter.fire(undefined);
        assert.strictEqual(counter, 1);

        emitter.fire(undefined);
        assert.strictEqual(counter, 2);

        registration1.dispose();
        emitter.fire(undefined);
        assert.strictEqual(counter, 2);
    });

    test('emitter - multiple listeners', () => {
        let counter = 0;
        const callback = (e: undefined) => {
            counter++;
        };

        const emitter = new Emitter<undefined>();

        const registration1 = emitter.registerListener(callback);
        const registration2 = emitter.registerListener(callback);

        emitter.fire(undefined);
        assert.strictEqual(counter, 2);

        registration1.dispose();
        emitter.fire(undefined);
        assert.strictEqual(counter, 3);

        registration2.dispose();
        emitter.fire(undefined);
        assert.strictEqual(counter, 3);
    });

    test('emitter - multiple listeners disposables', () => {
        let counter = 0;
        const callback = (e: undefined) => {
            counter++;
        };

        const emitter = new Emitter<undefined>();
        const disposables: IDisposable[] = [];

        const registration1 = emitter.registerListener(callback, disposables);
        const registration2 = emitter.registerListener(callback, disposables);

        emitter.fire(undefined);
        assert.strictEqual(counter, 2);

        while (disposables.length) {
            const disposable = disposables.pop();
            disposable?.dispose();
        }

        emitter.fire(undefined);
        assert.strictEqual(counter, 2);

        // no operations
        registration1.dispose();
        registration2.dispose();
        emitter.fire(undefined);
        assert.strictEqual(counter, 2);
    });

    test('emitter - dispose emitter', () => {
        let counter = 0;
        const callback = (e: undefined) => {
            counter++;
        };

        const emitter = new Emitter<undefined>();

        const registration1 = emitter.registerListener(callback);
        
        emitter.fire(undefined);
        assert.strictEqual(counter, 1);

        emitter.fire(undefined);
        assert.strictEqual(counter, 2);

        registration1.dispose();
        emitter.fire(undefined);
        assert.strictEqual(counter, 2);

        emitter.dispose();
        assert.throws(() => { emitter.registerListener(callback); });
    });

    test('emitter - fire error', () => {
        let counter = 0;
        const callback = (e: undefined) => {
            counter++;
        };

        const emitter = new Emitter<undefined>();

        const registration1 = emitter.registerListener(callback);
        const registration2 = emitter.registerListener(() => { throw new Error('expect error'); });
        const registration3 = emitter.registerListener(callback);

        const errors: any = [];
        ErrorHandler.setUnexpectedErrorExternalCallback((e) => errors.push(e));

        emitter.fire(undefined);

        assert.strictEqual(errors.length, 1);
        assert.strictEqual((errors[0] as Error).message, 'expect error');
        assert.strictEqual(counter, 2);
    });

    test('emitter - first add / last remove', () => {
        
        let firstAdded = false;
        let lastRemoved = false;

        const emitter = new Emitter<undefined>({
            onFirstListenerAdd: () => firstAdded = true,
            onLastListenerDidRemove: () => lastRemoved = true
        });

        const disposable = emitter.registerListener(() => {});

        assert.strictEqual(firstAdded, true);
        assert.strictEqual(lastRemoved, false);

        disposable.dispose();

        assert.strictEqual(firstAdded, true);
        assert.strictEqual(lastRemoved, true);
    });

    test('PauseableEmitter - basic', () => {
        
        const emitter = new PauseableEmitter<void>();

        let cnt = 0;
        const listener = () => { cnt++; };
        emitter.registerListener(listener);

        emitter.fire();
        assert.strictEqual(cnt, 1);

        emitter.pause();
        emitter.fire();
        assert.strictEqual(cnt, 1);
        emitter.fire();
        assert.strictEqual(cnt, 1);

        emitter.resume();
        emitter.fire();
        assert.strictEqual(cnt, 2);
        emitter.fire();
        assert.strictEqual(cnt, 3);

        emitter.dispose();
        emitter.fire();
        assert.strictEqual(cnt, 3);
    });

    test('DelayableEmitter - basic', () => {
        const emitter = new DelayableEmitter<number>();

        let cnt = 0;
        const listener = (e: number) => cnt++;
        emitter.registerListener(listener);

        emitter.fire(cnt);
        assert.strictEqual(cnt, 1);

        emitter.pause();
        emitter.fire(cnt);
        assert.strictEqual(cnt, 1);
        emitter.fire(cnt);
        assert.strictEqual(cnt, 1);

        emitter.resume();
        assert.strictEqual(cnt, 3);
        emitter.fire(cnt);
        assert.strictEqual(cnt, 4);

        emitter.dispose();
        emitter.fire(cnt);
        assert.strictEqual(cnt, 4);
    });

    test('SingalEmitter - basic', () => {
        const consumed1 = new Emitter<string>();
        const consumed2 = new Emitter<string>();
        
        const emitter = new SignalEmitter<string, boolean>([consumed1.registerListener, consumed2.registerListener], (str) => {
            if (str.length > 4) return true;
            else return false;
        });

        let result = false;
        emitter.registerListener((bool: boolean) => {
            result = bool;
        });

        consumed1.fire('abc');
        assert.strictEqual(result, false);
        consumed1.fire('abcd');
        assert.strictEqual(result, false);
        consumed1.fire('abcde');
        assert.strictEqual(result, true);
        
        consumed2.fire('abc');
        assert.strictEqual(result, false);
        consumed2.fire('abcde');
        assert.strictEqual(result, true);

        emitter.dispose();

        result = false;
        consumed1.fire('abcde');
        assert.strictEqual(result, false);
    });

    test('asyncEmitter - all sync', () => {
        let result = 0;
        const loop = 100;
        const emitter = new AsyncEmitter<void>();
        
        emitter.registerListener(async () => { for (let i = 0; i < loop; i++) result++; });
        emitter.registerListener(async () => { for (let i = 0; i < loop; i++) result++; });
        emitter.registerListener(async () => { for (let i = 0; i < loop; i++) result++; });
        emitter.fire();

        assert.strictEqual(result, 300);
    });

    test('asyncEmitter - all async', () => FakeAsync.run(async () => {
        let result = 0;
        const loop = 100;
        const emitter = new AsyncEmitter<void>();
        
        emitter.registerListener(async () => repeat(loop, () => result++));
        emitter.registerListener(async () => repeat(loop, () => result++));
        emitter.registerListener(async () => repeat(loop, () => result++));
        await emitter.fireAsync();

        assert.strictEqual(result, 300);
    }));
    
    test('asyncEmitter - async async', () => FakeAsync.run(async () => {
        let result = 0;
        const loop = 100;
        const emitter = new AsyncEmitter<void>();
        
        emitter.registerListener(async () => (async () => repeat(loop, () => result++))() );
        await emitter.fireAsync();

        assert.strictEqual(result, 100);
    }));
    
    test('asyncEmitter - partial async', () => FakeAsync.run(async () => {
        let result = 0;
        const loop = 100;
        const emitter = new AsyncEmitter<void>();
        
        emitter.registerListener(async () => repeat(loop, () => result++));
        emitter.registerListener(async () => repeat(loop, () => result++));
        emitter.registerListener(async () => repeat(loop, () => result++));
        await emitter.fireAsync();

        assert.strictEqual(result, 300);
    }));

    test('asyncEmitter - delay async', async () => {
        const emitter = new AsyncEmitter<void>();

        const blocker = new Blocker<void>();
        let onTimeout = false;

        setTimeout(() => {
            onTimeout = true;
            blocker.resolve();
        }, 10);

        emitter.registerListener(async () => blocker.waiting());
        await emitter.fireAsync();

        assert.ok(onTimeout);
    });

    test('asyncEmitter - this object replace', () => FakeAsync.run(async () => {
        let name!: string;

        class NameClass {
            constructor(public name: string) {}
            public async getName(): Promise<void> { name = this.name; }
        }

        const emitter = new AsyncEmitter<void>();

        const object = new NameClass('chris');
        const thisObject = new NameClass('replaced');

        const registration1 = emitter.registerListener(object.getName, undefined, thisObject);

        await emitter.fireAsync();

        assert.strictEqual(name, 'replaced');
    }));

    test('relayEmitter', () => {
        const input1 = new Emitter<number>();
        const input2 = new Emitter<number>();

        const relay = new RelayEmitter<number>();
        
        let total = 0;

        relay.registerListener((value) => {
            total += value;
        });
        relay.registerListener((value) => {
            total += value;
        });

        relay.setInput(input1.registerListener);
        
        input1.fire(5);
        assert.strictEqual(total, 10);


        relay.setInput(input2.registerListener);
        
        input2.fire(-5);
        assert.strictEqual(total, 0);
    });

    test('Event.map()', () => {
        const emitter = new Emitter<string>();

        let result = false;

        Event.map<string, boolean>(emitter.registerListener, (e: string) => {
            if (e.length > 4) return true;
            return false;
        })((e: boolean) => {
            result = e;
        });

        emitter.fire('abc');
        assert.strictEqual(result, false);
        emitter.fire('abcde');
        assert.strictEqual(result, true);

        result = false;
        emitter.dispose();
        emitter.fire('abcde');
        assert.strictEqual(result, false);
    });

    test('Event.each()', () => {
        const emitter = new Emitter<boolean>();

        let result = false;

        Event.each<boolean>(emitter.registerListener, (e: boolean) => {
            return !e;
        })((e: boolean) => {
            result = e;
        });

        emitter.fire(true);
        assert.strictEqual(result, false);
        emitter.fire(false);
        assert.strictEqual(result, true);

        result = false;
        emitter.dispose();
        emitter.fire(false);
        assert.strictEqual(result, false);
    });

    test('Event.any()', () => {
        const emitter1 = new Emitter<number>();
        const emitter2 = new Emitter<number>();
        const emitter3 = new Emitter<number>();

        const newEmitter = Event.any([emitter1.registerListener, emitter2.registerListener, emitter3.registerListener]);

        let result = -1;
        const disposable = newEmitter(e => {
            result = e;
        });

        emitter1.fire(3);
        assert.strictEqual(result, 3);

        emitter2.fire(10);
        assert.strictEqual(result, 10);

        emitter3.fire(-123);
        assert.strictEqual(result, -123);

        disposable.dispose();

        emitter1.fire(3);
        assert.strictEqual(result, -123);
    });

    test('Event.filter()', () => {
        const emitter = new Emitter<number>();

        const register = Event.filter(emitter.registerListener, num => num % 2 === 0);

        let result = -1;
        const listener = register(num => {
            result = num;
            assert.strictEqual(num % 2, 0);
        });

        emitter.fire(10);
        assert.strictEqual(result, 10);

        emitter.fire(9);
        assert.strictEqual(result, 10);

        emitter.fire(0);
        assert.strictEqual(result, 0);

        emitter.fire(-21);
        assert.strictEqual(result, 0);

        emitter.fire(10);
        assert.strictEqual(result, 10);

        listener.dispose();
        assert.strictEqual(emitter.hasListeners(), false);
        assert.strictEqual(emitter.isDisposed(), false);
    });

    test('event.once()', () => {
        const emitter = new Emitter<void>();
        let cnt1 = 0;
        let cnt2 = 0;
        let cnt3 = 0;

        const listener1 = emitter.registerListener(() => cnt1++);
        const listener2 = Event.once(emitter.registerListener)(() => cnt2++);
        const listener3 = Event.once(emitter.registerListener)(() => cnt3++);

        assert.strictEqual(cnt1, 0);
        assert.strictEqual(cnt2, 0);
        assert.strictEqual(cnt3, 0);

        listener3.dispose();
        emitter.fire();
        assert.strictEqual(cnt1, 1);
        assert.strictEqual(cnt2, 1);
        assert.strictEqual(cnt3, 0);

        emitter.fire();
        assert.strictEqual(cnt1, 2);
        assert.strictEqual(cnt2, 1);
        assert.strictEqual(cnt3, 0);

        listener1.dispose();
        listener2.dispose();
    });

    test('event.runAndListen', () => {
        const emitter = new Emitter<void>();
        let cnt = 0;
        Event.runAndListen(emitter.registerListener, () => cnt++); // cnt: 1
        emitter.fire(); // cnt: 2
        assert.strictEqual(cnt, 2);
    });
});