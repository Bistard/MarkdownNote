import * as assert from 'assert';
import { Scrollable } from 'src/base/common/scrollable';

suite('Scrollable-test', () => {
	suite('Constructor', () => {
		test('should initialize with correct default values', () => {
			const scrollable = new Scrollable(10, 100, 200, 0);
			assert.strictEqual(scrollable.getScrollbarSize(), 10);
			assert.strictEqual(scrollable.getViewportSize(), 100);
			assert.strictEqual(scrollable.getScrollSize(), 200);
			assert.strictEqual(scrollable.getScrollPosition(), 0);
		});
	});

	suite('setScrollbarSize', () => {
		test('should set the scrollbar size', () => {
			const scrollable = new Scrollable(10, 100, 200, 0);
			scrollable.setScrollbarSize(15);
			assert.strictEqual(scrollable.getScrollbarSize(), 15);
		});
	});

	suite('setViewportSize', () => {
		test('should update the viewport size and fire scroll event', () => {
			const scrollable = new Scrollable(10, 100, 200, 0);
			const oldClone = scrollable.clone();
			let scrollEventFired = false;

			scrollable.onDidScroll((event) => {
				scrollEventFired = true;
				assert.strictEqual(event.prevViewportSize, oldClone.getViewportSize());
				assert.strictEqual(event.viewportSize, 150);
			});

			scrollable.setViewportSize(150);
			assert.strictEqual(scrollable.getViewportSize(), 150);
			assert.strictEqual(scrollEventFired, true);
		});
	});

	suite('setScrollSize', () => {
		test('should update the scroll size and fire scroll event', () => {
			const scrollable = new Scrollable(10, 100, 200, 0);
			const oldClone = scrollable.clone();
			let scrollEventFired = false;

			scrollable.onDidScroll((event) => {
				scrollEventFired = true;
				assert.strictEqual(event.prevScrollSize, oldClone.getScrollSize());
				assert.strictEqual(event.scrollSize, 300);
			});

			scrollable.setScrollSize(300);
			assert.strictEqual(scrollable.getScrollSize(), 300);
			assert.strictEqual(scrollEventFired, true);
		});
	});

	suite('setScrollPosition', () => {
		test('should update the scroll position and fire scroll event', () => {
			const scrollable = new Scrollable(10, 100, 200, 0);
			const oldClone = scrollable.clone();
			let scrollEventFired = false;

			scrollable.onDidScroll((event) => {
				scrollEventFired = true;
				assert.strictEqual(event.prevScrollPosition, oldClone.getScrollPosition());
				assert.strictEqual(event.scrollPosition, 50);
				assert.strictEqual(event.delta, -50);
			});

			scrollable.setScrollPosition(50);
			assert.strictEqual(scrollable.getScrollPosition(), 50);
			assert.strictEqual(scrollEventFired, true);
		});
	});

	suite('getSliderMaxPosition', () => {
		test('should calculate the correct slider max position', () => {
			const scrollable = new Scrollable(10, 100, 200, 0);
			assert.strictEqual(scrollable.getSliderMaxPosition(), 100 - scrollable.getSliderSize());
		});
	});

	suite('getSliderRatio', () => {
		test('should return the correct slider ratio', () => {
			const scrollable = new Scrollable(10, 100, 200, 0);
			assert.strictEqual(scrollable.getSliderRatio(), (100 - scrollable.getSliderSize()) / (200 - 100));
		});
	});

	suite('required', () => {
		test('should return true when scrollbar is required', () => {
			const scrollable = new Scrollable(10, 100, 200, 0);
			assert.strictEqual(scrollable.required(), true);
		});

		test('should return false when scrollbar is not required', () => {
			const scrollable = new Scrollable(10, 100, 50, 0);
			assert.strictEqual(scrollable.required(), false);
		});
	});

	suite('getScrollPositionFromDelta', () => {
		test('should return the correct new scroll position from delta', () => {
			const scrollable = new Scrollable(10, 100, 200, 50);
			const newScrollPosition = scrollable.getScrollPositionFromDelta(10);
			assert.strictEqual(newScrollPosition, Math.round((scrollable.getSliderPosition() + 10) / scrollable.getSliderRatio()));
		});
	});

	suite('clone', () => {
		test('should return a new instance with the same values', () => {
			const scrollable = new Scrollable(10, 100, 200, 50);
			const clone = scrollable.clone();
			assert.notStrictEqual(clone, scrollable);
			assert.strictEqual(clone.getScrollbarSize(), scrollable.getScrollbarSize());
			assert.strictEqual(clone.getViewportSize(), scrollable.getViewportSize());
			assert.strictEqual(clone.getScrollSize(), scrollable.getScrollSize());
			assert.strictEqual(clone.getScrollPosition(), scrollable.getScrollPosition());
		});
	});

	suite('getScrollEvent', () => {
		test('should return a valid scroll event', () => {
			const scrollable = new Scrollable(10, 100, 200, 50);
			const scrollEvent = scrollable.getScrollEvent();
			assert.strictEqual(scrollEvent.scrollSize, 200);
			assert.strictEqual(scrollEvent.viewportSize, 100);
			assert.strictEqual(scrollEvent.scrollPosition, 50);
			assert.strictEqual(scrollEvent.prevScrollSize, 200);
			assert.strictEqual(scrollEvent.prevViewportSize, 100);
			assert.strictEqual(scrollEvent.prevScrollPosition, 50);
			assert.strictEqual(scrollEvent.delta, 0);
		});
	});
});

suite('Scrollable (Decimal Cases)', () => {

    suite('setViewportSize (Decimals)', () => {
        test('should handle decimal values for viewport size', () => {
            const scrollable = new Scrollable(10, 100, 200, 0);
            const oldClone = scrollable.clone();
            let scrollEventFired = false;

            scrollable.onDidScroll((event) => {
                scrollEventFired = true;
                assert.strictEqual(event.prevViewportSize, oldClone.getViewportSize());
                assert.strictEqual(event.viewportSize, 150.5);
            });

            scrollable.setViewportSize(150.5);
            assert.strictEqual(scrollable.getViewportSize(), 150.5);
            assert.strictEqual(scrollEventFired, true);
        });
    });

    suite('setScrollSize (Decimals)', () => {
        test('should handle decimal values for scroll size', () => {
            const scrollable = new Scrollable(10, 100, 200, 0);
            const oldClone = scrollable.clone();
            let scrollEventFired = false;

            scrollable.onDidScroll((event) => {
                scrollEventFired = true;
                assert.strictEqual(event.prevScrollSize, oldClone.getScrollSize());
                assert.strictEqual(event.scrollSize, 300.75);
            });

            scrollable.setScrollSize(300.75);
            assert.strictEqual(scrollable.getScrollSize(), 300.75);
            assert.strictEqual(scrollEventFired, true);
        });
    });

    suite('setScrollPosition (Decimals)', () => {
        test('should handle decimal values for scroll position', () => {
            const scrollable = new Scrollable(10, 100, 200, 0);
            const oldClone = scrollable.clone();
            let scrollEventFired = false;

            scrollable.onDidScroll((event) => {
                scrollEventFired = true;
                assert.strictEqual(event.prevScrollPosition, oldClone.getScrollPosition());
                assert.strictEqual(event.scrollPosition, 50.25);
                assert.strictEqual(event.delta, -50.25);
            });

            scrollable.setScrollPosition(50.25);
            assert.strictEqual(scrollable.getScrollPosition(), 50.25);
            assert.strictEqual(scrollEventFired, true);
        });
    });

    suite('getSliderMaxPosition (Decimals)', () => {
        test('should calculate the correct slider max position with decimals', () => {
            const scrollable = new Scrollable(10, 100.5, 200, 0);
            assert.strictEqual(scrollable.getSliderMaxPosition(), 100.5 - scrollable.getSliderSize());
        });
    });

    suite('getSliderRatio (Decimals)', () => {
        test('should calculate the correct slider ratio with decimals', () => {
            const scrollable = new Scrollable(10, 100.5, 200.75, 0);
            assert.strictEqual(
                scrollable.getSliderRatio(),
                (100.5 - scrollable.getSliderSize()) / (200.75 - 100.5)
            );
        });
    });

    suite('getScrollPositionFromDelta (Decimals)', () => {
        test('should handle decimal delta values', () => {
            const scrollable = new Scrollable(10, 100, 200, 50);
            const newScrollPosition = scrollable.getScrollPositionFromDelta(10.5);
            assert.strictEqual(newScrollPosition, Math.round((scrollable.getSliderPosition() + 10.5) / scrollable.getSliderRatio()));
        });
    });

    suite('required (Decimals)', () => {
        test('should return true when scrollbar is required with decimal values', () => {
            const scrollable = new Scrollable(10, 100.5, 200.75, 0);
            assert.strictEqual(scrollable.required(), true);
        });

        test('should return false when scrollbar is not required with decimal values', () => {
            const scrollable = new Scrollable(10, 100.5, 50.25, 0);
            assert.strictEqual(scrollable.required(), false);
        });
    });

    suite('getScrollEvent (Decimals)', () => {
        test('should return a valid scroll event with decimal values', () => {
            const scrollable = new Scrollable(10, 100.5, 200.75, 50.25);
            const scrollEvent = scrollable.getScrollEvent();
            assert.strictEqual(scrollEvent.scrollSize, 200.75);
            assert.strictEqual(scrollEvent.viewportSize, 100.5);
            assert.strictEqual(scrollEvent.scrollPosition, 50.25);
            assert.strictEqual(scrollEvent.prevScrollSize, 200.75);
            assert.strictEqual(scrollEvent.prevViewportSize, 100.5);
            assert.strictEqual(scrollEvent.prevScrollPosition, 50.25);
            assert.strictEqual(scrollEvent.delta, 0);
        });
    });
});