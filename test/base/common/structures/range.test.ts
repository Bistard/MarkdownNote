import * as assert from 'assert';
import { IRange, IRangeList, Range, RangeTable } from 'src/base/common/structures/range';

function createRange(start: number, end: number): IRange {
	return { start, end } as IRange;
}

suite('Range-test', () => {

	test('empty', () => {
		assert.deepStrictEqual(Range.empty(Range.EMPTY), true);
		assert.deepStrictEqual(Range.empty({start: 0, end: 0}), true);
		assert.deepStrictEqual(Range.empty({start: 31, end: 31}), true);
		assert.deepStrictEqual(Range.empty({start: 0, end: 31}), false);
		assert.deepStrictEqual(Range.empty({start: 31, end: 0}), true);
	});

	test('within', () => {
		assert.deepStrictEqual(Range.within(Range.EMPTY, 5), false);
		assert.deepStrictEqual(Range.within(createRange(0, 4), 5), false);
		assert.deepStrictEqual(Range.within(createRange(0, 4), -1), false);
		assert.deepStrictEqual(Range.within(createRange(0, 4), 0), true);
		assert.deepStrictEqual(Range.within(createRange(0, 4), 4), true);
	});

	test('exact', () => {
		assert.deepStrictEqual(Range.exact(Range.EMPTY, createRange(0, 0)), true);
		assert.deepStrictEqual(Range.exact(Range.EMPTY, createRange(5, 5)), false);
		assert.deepStrictEqual(Range.exact(createRange(0, 4), createRange(0, 4)), true);
		assert.deepStrictEqual(Range.exact(createRange(0, 4), createRange(4, 8)), false);
	});

	test('same', () => {
		assert.deepStrictEqual(Range.same(Range.EMPTY, createRange(0, 0)), true);
		assert.deepStrictEqual(Range.same(Range.EMPTY, createRange(5, 5)), true);
		assert.deepStrictEqual(Range.same(createRange(0, 4), createRange(0, 4)), true);
		assert.deepStrictEqual(Range.same(createRange(0, 4), createRange(4, 8)), true);
	});

	test('shift', () => {
		assert.deepStrictEqual(Range.shift(Range.EMPTY, 10), {start: 10, end: 10});
		assert.deepStrictEqual(Range.shift({start: 0, end: 31}, 10), {start: 10, end: 41});
	});

	test('intersection', () => {
		assert.deepStrictEqual(Range.intersection({ start: 0, end: 0 }, { start: 0, end: 0 }), { start: 0, end: 0 });
		assert.deepStrictEqual(Range.intersection({ start: 0, end: 0 }, { start: 5, end: 5 }), { start: 0, end: 0 });
		assert.deepStrictEqual(Range.intersection({ start: 0, end: 1 }, { start: 5, end: 6 }), { start: 0, end: 0 });
		assert.deepStrictEqual(Range.intersection({ start: 5, end: 6 }, { start: 0, end: 1 }), { start: 0, end: 0 });
		assert.deepStrictEqual(Range.intersection({ start: 0, end: 5 }, { start: 2, end: 2 }), { start: 0, end: 0 });
		assert.deepStrictEqual(Range.intersection({ start: 0, end: 1 }, { start: 0, end: 1 }), { start: 0, end: 1 });
		assert.deepStrictEqual(Range.intersection({ start: 0, end: 10 }, { start: 0, end: 5 }), { start: 0, end: 5 });
		assert.deepStrictEqual(Range.intersection({ start: 0, end: 5 }, { start: 0, end: 10 }), { start: 0, end: 5 });
		assert.deepStrictEqual(Range.intersection({ start: 0, end: 10 }, { start: 5, end: 10 }), { start: 5, end: 10 });
		assert.deepStrictEqual(Range.intersection({ start: 5, end: 10 }, { start: 0, end: 10 }), { start: 5, end: 10 });
		assert.deepStrictEqual(Range.intersection({ start: 0, end: 10 }, { start: 2, end: 8 }), { start: 2, end: 8 });
		assert.deepStrictEqual(Range.intersection({ start: 2, end: 8 }, { start: 0, end: 10 }), { start: 2, end: 8 });
		assert.deepStrictEqual(Range.intersection({ start: 0, end: 10 }, { start: 5, end: 15 }), { start: 5, end: 10 });
		assert.deepStrictEqual(Range.intersection({ start: 5, end: 15 }, { start: 0, end: 10 }), { start: 5, end: 10 });
	});

	suite('relativeComplement', function() {
		test('basics', () => {
			assert.deepStrictEqual(Range.relativeComplement({start: 50, end: 150}, {start: 0, end: 200}), [{start: 0, end: 50}, {start: 150, end: 200}]);
			assert.deepStrictEqual(Range.relativeComplement({start: 0, end: 150}, {start: 0, end: 200}), [Range.EMPTY, {start: 150, end: 200}]);
			assert.deepStrictEqual(Range.relativeComplement({start: 50, end: 150}, {start: 0, end: 150}), [Range.EMPTY, {start: 0, end: 50}]);
			assert.deepStrictEqual(Range.relativeComplement({start: 50, end: 150}, {start: 50, end: 150}), [Range.EMPTY, Range.EMPTY]);
			assert.deepStrictEqual(Range.relativeComplement({start: 0, end: 50}, {start: 50, end: 100}), [Range.EMPTY, {start: 50, end: 100}]);
		});
	
		test('B fully within A', function() {
			const A: IRange = { start: 1, end: 5 };
			const B: IRange = { start: 2, end: 4 };
			assert.deepStrictEqual(Range.relativeComplement(A, B), [Range.EMPTY, Range.EMPTY]);
		});
	
		test('A and B non-overlapping with B after A', function() {
			const A: IRange = { start: 1, end: 3 };
			const B: IRange = { start: 4, end: 6 };
			assert.deepStrictEqual(Range.relativeComplement(A, B), [Range.EMPTY, { start: 4, end: 6 }]);
		});
	
		test('A and B non-overlapping with B before A', function() {
			const A: IRange = { start: 5, end: 7 };
			const B: IRange = { start: 1, end: 4 };
			assert.deepStrictEqual(Range.relativeComplement(A, B), [Range.EMPTY, { start: 1, end: 4 }]);
		});
	
		test('A overlaps B at start', function() {
			const A: IRange = { start: 1, end: 5 };
			const B: IRange = { start: 0, end: 3 };
			assert.deepStrictEqual(Range.relativeComplement(A, B), [Range.EMPTY, { start: 0, end: 1 }]);
		});
	
		test('A overlaps B at end', function() {
			const A: IRange = { start: 2, end: 6 };
			const B: IRange = { start: 5, end: 8 };
			assert.deepStrictEqual(Range.relativeComplement(A, B), [Range.EMPTY, { start: 6, end: 8 }]);
		});
	
		test('A equals B', function() {
			const A: IRange = { start: 2, end: 5 };
			const B: IRange = { start: 2, end: 5 };
			assert.deepStrictEqual(Range.relativeComplement(A, B), [Range.EMPTY, Range.EMPTY]);
		});
	
		test('B entirely before A', function() {
			const A: IRange = { start: 10, end: 15 };
			const B: IRange = { start: 1, end: 5 };
			assert.deepStrictEqual(Range.relativeComplement(A, B), [Range.EMPTY, { start: 1, end: 5 }]);
		});
	
		test('B entirely after A', function() {
			const A: IRange = { start: 1, end: 5 };
			const B: IRange = { start: 6, end: 10 };
			assert.deepStrictEqual(Range.relativeComplement(A, B), [Range.EMPTY, { start: 6, end: 10 }]);
		});
	
		test('A fully contains B', function() {
			const A: IRange = { start: 1, end: 10 };
			const B: IRange = { start: 2, end: 5 };
			assert.deepStrictEqual(Range.relativeComplement(A, B), [Range.EMPTY, Range.EMPTY]);
		});
	});

	test('listIntersection', () => {
		assert.deepStrictEqual(
			Range.listIntersection(
				{ start: 0, end: 0 },
				[{ range: { start: 0, end: 10 }, size: 1 }]
			),
			[]
		);

		assert.deepStrictEqual(
			Range.listIntersection(
				{ start: 10, end: 20 },
				[{ range: { start: 0, end: 10 }, size: 1 }]
			),
			[]
		);

		assert.deepStrictEqual(
			Range.listIntersection(
				{ start: 2, end: 8 },
				[{ range: { start: 0, end: 10 }, size: 1 }]
			),
			[{ range: { start: 2, end: 8 }, size: 1 }]
		);

		assert.deepStrictEqual(
			Range.listIntersection(
				{ start: 2, end: 8 },
				[{ range: { start: 0, end: 10 }, size: 1 }, { range: { start: 10, end: 20 }, size: 5 }]
			),
			[{ range: { start: 2, end: 8 }, size: 1 }]
		);

		assert.deepStrictEqual(
			Range.listIntersection(
				{ start: 12, end: 18 },
				[{ range: { start: 0, end: 10 }, size: 1 }, { range: { start: 10, end: 20 }, size: 5 }]
			),
			[{ range: { start: 12, end: 18 }, size: 5 }]
		);

		assert.deepStrictEqual(
			Range.listIntersection(
				{ start: 2, end: 18 },
				[{ range: { start: 0, end: 10 }, size: 1 }, { range: { start: 10, end: 20 }, size: 5 }]
			),
			[{ range: { start: 2, end: 10 }, size: 1 }, { range: { start: 10, end: 18 }, size: 5 }]
		);

		assert.deepStrictEqual(
			Range.listIntersection(
				{ start: 2, end: 28 },
				[{ range: { start: 0, end: 10 }, size: 1 }, { range: { start: 10, end: 20 }, size: 5 }, { range: { start: 20, end: 30 }, size: 10 }]
			),
			[{ range: { start: 2, end: 10 }, size: 1 }, { range: { start: 10, end: 20 }, size: 5 }, { range: { start: 20, end: 28 }, size: 10 }]
		);
	});

	test('flatten', () => {
		assert.deepStrictEqual(Range.flatten([]), []);

		assert.deepStrictEqual(
			Range.flatten([{ range: { start: 0, end: 10 }, size: 1 }]),
			[{ range: { start: 0, end: 10 }, size: 1 }]
		);

		assert.deepStrictEqual(
			Range.flatten([
				{ range: { start: 0, end: 10 }, size: 1 },
				{ range: { start: 10, end: 20 }, size: 1 }
			]),
			[{ range: { start: 0, end: 20 }, size: 1 }]
		);

		assert.deepStrictEqual(
			Range.flatten([
				{ range: { start: 0, end: 10 }, size: 1 },
				{ range: { start: 10, end: 20 }, size: 1 },
				{ range: { start: 20, end: 100 }, size: 1 }
			]),
			[{ range: { start: 0, end: 100 }, size: 1 }]
		);

		assert.deepStrictEqual(
			Range.flatten([
				{ range: { start: 0, end: 10 }, size: 1 },
				{ range: { start: 10, end: 20 }, size: 5 },
				{ range: { start: 20, end: 30 }, size: 10 }
			]),
			[
				{ range: { start: 0, end: 10 }, size: 1 },
				{ range: { start: 10, end: 20 }, size: 5 },
				{ range: { start: 20, end: 30 }, size: 10 }
			]
		);

		assert.deepStrictEqual(
			Range.flatten([
				{ range: { start: 0, end: 10 }, size: 1 },
				{ range: { start: 10, end: 20 }, size: 2 },
				{ range: { start: 20, end: 100 }, size: 2 }
			]),
			[
				{ range: { start: 0, end: 10 }, size: 1 },
				{ range: { start: 10, end: 100 }, size: 2 }
			]
		);
	});

	test('concatenate', () => {
		const part1: IRangeList[] = [
			{range: {start: 0, end: 20}, size: 10}, 
			{range: {start: 10, end: 30}, size: 10}, 
			{range: {start: 15, end: 20}, size: 10}, 
		];
		const part2: IRangeList[] = [
			{range: {start: 0, end: 20}, size: 10}, 
			{range: {start: 10, end: 50}, size: 10}, 
		];
		assert.deepStrictEqual(Range.concatenate(part1, part2), [{range: {start: 0, end: 50}, size: 10}]);

		const part3: IRangeList[] = [
			{range: {start: 10, end: 30}, size: 20}, 
		];
		assert.deepStrictEqual(Range.concatenate(part1, part2, part3), [{range: {start: 0, end: 50}, size: 10}, {range: {start: 10, end: 30}, size: 20}]);
	});

	suite('Range-extra', () => {

		suite('empty', () => {
			test('should return true for empty ranges', () => {
				assert.strictEqual(Range.empty({ start: 5, end: 5 }), true);
				assert.strictEqual(Range.empty({ start: 10, end: 5 }), true);
			});
	
			test('should return false for non-empty ranges', () => {
				assert.strictEqual(Range.empty({ start: 5, end: 10 }), false);
			});
		});
	
		suite('within', () => {
			test('should return true if number is within range', () => {
				assert.strictEqual(Range.within({ start: 5, end: 10 }, 7), true);
			});
	
			test('should return false if number is outside range', () => {
				assert.strictEqual(Range.within({ start: 5, end: 10 }, 4), false);
				assert.strictEqual(Range.within({ start: 5, end: 10 }, 11), false);
			});
		});
	
		suite('exact', () => {
			test('should return true for identical ranges', () => {
				assert.strictEqual(Range.exact({ start: 5, end: 10 }, { start: 5, end: 10 }), true);
			});
	
			test('should return false for different ranges', () => {
				assert.strictEqual(Range.exact({ start: 5, end: 10 }, { start: 5, end: 9 }), false);
			});
		});
	
		suite('same', () => {
			test('should return true for ranges with the same size', () => {
				assert.strictEqual(Range.same({ start: 5, end: 10 }, { start: 20, end: 25 }), true);
			});
	
			test('should return false for ranges with different sizes', () => {
				assert.strictEqual(Range.same({ start: 5, end: 10 }, { start: 20, end: 24 }), false);
			});
		});
	
		suite('shift', () => {
			test('should shift the range by a distance', () => {
				const shifted = Range.shift({ start: 5, end: 10 }, 3);
				assert.deepStrictEqual(shifted, { start: 8, end: 13 });
			});
		});
	
		suite('relativeComplement', () => {
			test('should calculate the relative complement correctly', () => {
				const [before, after] = Range.relativeComplement({ start: 5, end: 10 }, { start: 3, end: 12 });
				assert.deepStrictEqual(before, { start: 3, end: 5 });
				assert.deepStrictEqual(after, { start: 10, end: 12 });
			});
	
			test('should return empty ranges if no complement exists', () => {
				const [before, after] = Range.relativeComplement({ start: 3, end: 12 }, { start: 5, end: 10 });
				assert.deepStrictEqual(before, Range.EMPTY);
				assert.deepStrictEqual(after, Range.EMPTY);
			});
		});
	
		suite('intersection', () => {
			test('should return the intersection of two ranges', () => {
				const intersect = Range.intersection({ start: 5, end: 10 }, { start: 8, end: 12 });
				assert.deepStrictEqual(intersect, { start: 8, end: 10 });
			});
	
			test('should return an empty range if there is no intersection', () => {
				const intersect = Range.intersection({ start: 5, end: 10 }, { start: 12, end: 15 });
				assert.deepStrictEqual(intersect, Range.EMPTY);
			});
		});
	
		suite('listIntersection', () => {
			test('should return multiple intersections with range lists', () => {
				const intersects = Range.listIntersection(
					{ start: 5, end: 20 },
					[
						{ range: { start: 0, end: 10 }, size: 5 },
						{ range: { start: 15, end: 25 }, size: 10 }
					]
				);
				assert.deepStrictEqual(intersects, [
					{ range: { start: 5, end: 10 }, size: 5 },
					{ range: { start: 15, end: 20 }, size: 10 }
				]);
			});
		});
	
		suite('flatten', () => {
			test('should merge consecutive ranges with the same size', () => {
				const flattened = Range.flatten([
					{ range: { start: 0, end: 10 }, size: 5 },
					{ range: { start: 10, end: 20 }, size: 5 },
					{ range: { start: 20, end: 30 }, size: 10 }
				]);
				assert.deepStrictEqual(flattened, [
					{ range: { start: 0, end: 20 }, size: 5 },
					{ range: { start: 20, end: 30 }, size: 10 }
				]);
			});
		});
	
		suite('concatenate', () => {
			test('should concatenate multiple range lists and flatten them', () => {
				const concatenated = Range.concatenate(
					[
						{ range: { start: 0, end: 10 }, size: 5 },
						{ range: { start: 10, end: 20 }, size: 5 }
					],
					[
						{ range: { start: 20, end: 30 }, size: 10 }
					]
				);
				assert.deepStrictEqual(concatenated, [
					{ range: { start: 0, end: 20 }, size: 5 },
					{ range: { start: 20, end: 30 }, size: 10 }
				]);
			});
		});
	});
});

suite('Range-test extra', () => {
    suite('Range.empty', () => {
        test('should return true for empty range', () => {
            const range: IRange = { start: 5, end: 5 };
            assert.strictEqual(Range.empty(range), true);
        });

        test('should return false for non-empty range', () => {
            const range: IRange = { start: 5, end: 10 };
            assert.strictEqual(Range.empty(range), false);
        });
    });

    suite('Range.within', () => {
        test('should return true when number is within range', () => {
            const range: IRange = { start: 5, end: 10 };
            assert.strictEqual(Range.within(range, 7), true);
        });

        test('should return false when number is outside range', () => {
            const range: IRange = { start: 5, end: 10 };
            assert.strictEqual(Range.within(range, 11), false);
        });

        test('should return true when number is at range boundaries', () => {
            const range: IRange = { start: 5, end: 10 };
            assert.strictEqual(Range.within(range, 5), true);
            assert.strictEqual(Range.within(range, 10), true);
        });
    });

    suite('Range.exact', () => {
        test('should return true for identical ranges', () => {
            const A: IRange = { start: 5, end: 10 };
            const B: IRange = { start: 5, end: 10 };
            assert.strictEqual(Range.exact(A, B), true);
        });

        test('should return false for non-identical ranges', () => {
            const A: IRange = { start: 5, end: 10 };
            const B: IRange = { start: 6, end: 10 };
            assert.strictEqual(Range.exact(A, B), false);
        });
    });

    suite('Range.same', () => {
        test('should return true for ranges with same size', () => {
            const A: IRange = { start: 5, end: 10 };
            const B: IRange = { start: 15, end: 20 };
            assert.strictEqual(Range.same(A, B), true);
        });

        test('should return false for ranges with different sizes', () => {
            const A: IRange = { start: 5, end: 10 };
            const B: IRange = { start: 15, end: 25 };
            assert.strictEqual(Range.same(A, B), false);
        });
    });

    suite('Range.shift', () => {
        test('should shift range by given distance', () => {
            const range: IRange = { start: 5, end: 10 };
            const shifted = Range.shift(range, 3);
            assert.deepStrictEqual(shifted, { start: 8, end: 13 });
        });
    });

    suite('Range.relativeComplement', () => {
        test('should return correct relative complement ranges', () => {
            const A: IRange = { start: 5, end: 15 };
            const B: IRange = { start: 10, end: 20 };
            const complement = Range.relativeComplement(A, B);
            assert.deepStrictEqual(complement, [
                Range.EMPTY,
                { start: 15, end: 20 }
            ]);
        });

        test('should return EMPTY ranges if there is no complement', () => {
            const A: IRange = { start: 5, end: 15 };
            const B: IRange = { start: 5, end: 15 };
            const complement = Range.relativeComplement(A, B);
            assert.deepStrictEqual(complement, [
                Range.EMPTY,
                Range.EMPTY
            ]);
        });
    });

    suite('Range.intersection', () => {
        test('should return intersection of two ranges', () => {
            const A: IRange = { start: 5, end: 15 };
            const B: IRange = { start: 10, end: 20 };
            assert.deepStrictEqual(Range.intersection(A, B), { start: 10, end: 15 });
        });

        test('should return EMPTY if no intersection', () => {
            const A: IRange = { start: 5, end: 10 };
            const B: IRange = { start: 15, end: 20 };
            assert.deepStrictEqual(Range.intersection(A, B), Range.EMPTY);
        });
    });

    suite('Range.listIntersection', () => {
        test('should return intersections with size preserved', () => {
            const range: IRange = { start: 5, end: 15 };
            const rangeLists: IRangeList[] = [
                { range: { start: 0, end: 10 }, size: 2 },
                { range: { start: 10, end: 20 }, size: 3 }
            ];
            const intersections = Range.listIntersection(range, rangeLists);
            assert.deepStrictEqual(intersections, [
                { range: { start: 5, end: 10 }, size: 2 },
                { range: { start: 10, end: 15 }, size: 3 }
            ]);
        });
    });

    suite('Range.flatten', () => {
        test('should merge adjacent range lists with same size', () => {
            const lists: IRangeList[] = [
                { range: { start: 0, end: 5 }, size: 2 },
                { range: { start: 5, end: 10 }, size: 2 },
                { range: { start: 10, end: 15 }, size: 3 }
            ];
            const flattened = Range.flatten(lists);
            assert.deepStrictEqual(flattened, [
                { range: { start: 0, end: 10 }, size: 2 },
                { range: { start: 10, end: 15 }, size: 3 }
            ]);
        });
    });

    suite('Range.concatenate', () => {
        test('should concatenate multiple range lists into one', () => {
            const lists1: IRangeList[] = [
                { range: { start: 0, end: 5 }, size: 2 }
            ];
            const lists2: IRangeList[] = [
                { range: { start: 5, end: 10 }, size: 3 }
            ];
            const concatenated = Range.concatenate(lists1, lists2);
            assert.deepStrictEqual(concatenated, [
                { range: { start: 0, end: 5 }, size: 2 },
                { range: { start: 5, end: 10 }, size: 3 }
            ]);
        });
    });
});

suite('RangeTable-test', () => {
	let rangeMap: RangeTable;

	setup(() => {
		rangeMap = new RangeTable();
	});

	test('empty', () => {
		assert.strictEqual(rangeMap.size(), 0);
		assert.strictEqual(rangeMap.count(), 0);
	});

	const one = { size: 1 };
	const two = { size: 2 };
	const three = { size: 3 };
	const five = { size: 5 };
	const ten = { size: 10 };

	test('length & count', () => {
		rangeMap.splice(0, 0, [one]);
		assert.strictEqual(rangeMap.size(), 1);
		assert.strictEqual(rangeMap.count(), 1);
	});

	test('length & count #2', () => {
		rangeMap.splice(0, 0, [one, one, one, one, one]);
		assert.strictEqual(rangeMap.size(), 5);
		assert.strictEqual(rangeMap.count(), 5);
	});

	test('length & count #3', () => {
		rangeMap.splice(0, 0, [five]);
		assert.strictEqual(rangeMap.size(), 5);
		assert.strictEqual(rangeMap.count(), 1);
	});

	test('length & count #4', () => {
		rangeMap.splice(0, 0, [five, five, five, five, five]);
		assert.strictEqual(rangeMap.size(), 25);
		assert.strictEqual(rangeMap.count(), 5);
	});

	test('insert', () => {
		rangeMap.splice(0, 0, [five, five, five, five, five]);
		assert.strictEqual(rangeMap.size(), 25);
		assert.strictEqual(rangeMap.count(), 5);

		rangeMap.splice(0, 0, [five, five, five, five, five]);
		assert.strictEqual(rangeMap.size(), 50);
		assert.strictEqual(rangeMap.count(), 10);

		rangeMap.splice(5, 0, [ten, ten]);
		assert.strictEqual(rangeMap.size(), 70);
		assert.strictEqual(rangeMap.count(), 12);

		rangeMap.splice(12, 0, [{ size: 200 }]);
		assert.strictEqual(rangeMap.size(), 270);
		assert.strictEqual(rangeMap.count(), 13);
	});

	test('delete', () => {
		rangeMap.splice(0, 0, [five, five, five, five, five,
			five, five, five, five, five,
			five, five, five, five, five,
			five, five, five, five, five]);
		assert.strictEqual(rangeMap.size(), 100);
		assert.strictEqual(rangeMap.count(), 20);

		rangeMap.splice(10, 5);
		assert.strictEqual(rangeMap.size(), 75);
		assert.strictEqual(rangeMap.count(), 15);

		rangeMap.splice(0, 1);
		assert.strictEqual(rangeMap.size(), 70);
		assert.strictEqual(rangeMap.count(), 14);

		rangeMap.splice(1, 13);
		assert.strictEqual(rangeMap.size(), 5);
		assert.strictEqual(rangeMap.count(), 1);

		rangeMap.splice(1, 1);
		assert.strictEqual(rangeMap.size(), 5);
		assert.strictEqual(rangeMap.count(), 1);
	});

	test('insert & delete', () => {
		assert.strictEqual(rangeMap.size(), 0);
		assert.strictEqual(rangeMap.count(), 0);

		rangeMap.splice(0, 0, [one]);
		assert.strictEqual(rangeMap.size(), 1);
		assert.strictEqual(rangeMap.count(), 1);

		rangeMap.splice(0, 1);
		assert.strictEqual(rangeMap.size(), 0);
		assert.strictEqual(rangeMap.count(), 0);
	});

	test('insert & delete #2', () => {
		rangeMap.splice(0, 0, [one, one, one, one, one,
			one, one, one, one, one]);
		rangeMap.splice(2, 6);
		assert.strictEqual(rangeMap.count(), 4);
		assert.strictEqual(rangeMap.size(), 4);
	});

	test('insert & delete #3', () => {
		rangeMap.splice(0, 0, [one, one, one, one, one,
			one, one, one, one, one,
			two, two, two, two, two,
			two, two, two, two, two]);
		rangeMap.splice(8, 4);
		assert.strictEqual(rangeMap.count(), 16);
		assert.strictEqual(rangeMap.size(), 24);
	});

	test('insert & delete #3', () => {
		rangeMap.splice(0, 0, [one, one, one, one, one,
			one, one, one, one, one,
			two, two, two, two, two,
			two, two, two, two, two]);
		rangeMap.splice(5, 0, [three, three, three, three, three]);
		assert.strictEqual(rangeMap.count(), 25);
		assert.strictEqual(rangeMap.size(), 45);

		rangeMap.splice(4, 7);
		assert.strictEqual(rangeMap.count(), 18);
		assert.strictEqual(rangeMap.size(), 28);
	});

	suite('indexAt, positionAt', () => {
		test('empty', () => {
			assert.strictEqual(rangeMap.indexAt(0), 0);
			assert.strictEqual(rangeMap.indexAt(10), 0);
			assert.strictEqual(rangeMap.indexAt(-1), -1);
			assert.strictEqual(rangeMap.positionAt(0), -1);
			assert.strictEqual(rangeMap.positionAt(10), -1);
			assert.strictEqual(rangeMap.positionAt(-1), -1);
		});

		test('simple', () => {
			rangeMap.splice(0, 0, [one]);
			assert.strictEqual(rangeMap.indexAt(0), 0);
			assert.strictEqual(rangeMap.indexAt(1), 1);
			assert.strictEqual(rangeMap.positionAt(0), 0);
			assert.strictEqual(rangeMap.positionAt(1), -1);
		});

		test('simple #2', () => {
			rangeMap.splice(0, 0, [ten]);
			assert.strictEqual(rangeMap.indexAt(0), 0);
			assert.strictEqual(rangeMap.indexAt(5), 0);
			assert.strictEqual(rangeMap.indexAt(9), 0);
			assert.strictEqual(rangeMap.indexAt(10), 1);
			assert.strictEqual(rangeMap.positionAt(0), 0);
			assert.strictEqual(rangeMap.positionAt(1), -1);
		});

		test('insert', () => {
			rangeMap.splice(0, 0, [one, one, one, one, one, one, one, one, one, one]);
			assert.strictEqual(rangeMap.indexAt(0), 0);
			assert.strictEqual(rangeMap.indexAt(1), 1);
			assert.strictEqual(rangeMap.indexAt(5), 5);
			assert.strictEqual(rangeMap.indexAt(9), 9);
			assert.strictEqual(rangeMap.indexAt(10), 10);
			assert.strictEqual(rangeMap.indexAt(11), 10);

			rangeMap.splice(10, 0, [one, one, one, one, one, one, one, one, one, one]);
			assert.strictEqual(rangeMap.indexAt(10), 10);
			assert.strictEqual(rangeMap.indexAt(19), 19);
			assert.strictEqual(rangeMap.indexAt(20), 20);
			assert.strictEqual(rangeMap.indexAt(21), 20);
			assert.strictEqual(rangeMap.positionAt(0), 0);
			assert.strictEqual(rangeMap.positionAt(1), 1);
			assert.strictEqual(rangeMap.positionAt(19), 19);
			assert.strictEqual(rangeMap.positionAt(20), -1);
		});

		test('delete', () => {
			rangeMap.splice(0, 0, [one, one, one, one, one, one, one, one, one, one]);
			rangeMap.splice(2, 6);

			assert.strictEqual(rangeMap.indexAt(0), 0);
			assert.strictEqual(rangeMap.indexAt(1), 1);
			assert.strictEqual(rangeMap.indexAt(3), 3);
			assert.strictEqual(rangeMap.indexAt(4), 4);
			assert.strictEqual(rangeMap.indexAt(5), 4);
			assert.strictEqual(rangeMap.positionAt(0), 0);
			assert.strictEqual(rangeMap.positionAt(1), 1);
			assert.strictEqual(rangeMap.positionAt(3), 3);
			assert.strictEqual(rangeMap.positionAt(4), -1);
		});

		test('delete #2', () => {
			rangeMap.splice(0, 0, [ten, ten, ten, ten, ten, ten, ten, ten, ten, ten]);
			rangeMap.splice(2, 6);

			assert.strictEqual(rangeMap.indexAt(0), 0);
			assert.strictEqual(rangeMap.indexAt(1), 0);
			assert.strictEqual(rangeMap.indexAt(30), 3);
			assert.strictEqual(rangeMap.indexAt(40), 4);
			assert.strictEqual(rangeMap.indexAt(50), 4);
			assert.strictEqual(rangeMap.positionAt(0), 0);
			assert.strictEqual(rangeMap.positionAt(1), 10);
			assert.strictEqual(rangeMap.positionAt(2), 20);
			assert.strictEqual(rangeMap.positionAt(3), 30);
			assert.strictEqual(rangeMap.positionAt(4), -1);
		});
	});
});

suite('RangeTable-test-extra', () => {
    let table: RangeTable;

    setup(() => {
        table = new RangeTable();
    });

    suite('count', () => {
        test('should return 0 for an empty table', () => {
            assert.strictEqual(table.count(), 0);
        });

        test('should return the correct count after adding items', () => {
            table.splice(0, 0, [{ size: 10 }, { size: 15 }]);
            assert.strictEqual(table.count(), 2);
        });

        test('should update count correctly after removing items', () => {
            table.splice(0, 0, [{ size: 10 }, { size: 15 }, { size: 20 }]);
            table.splice(1, 1); // Remove 1 item
            assert.strictEqual(table.count(), 2);
        });
    });

    suite('size', () => {
        test('should return 0 for an empty table', () => {
            assert.strictEqual(table.size(), 0);
        });

        test('should return the total size of all items', () => {
            table.splice(0, 0, [{ size: 10 }, { size: 15 }]);
            assert.strictEqual(table.size(), 25);
        });

        test('should update size correctly after splicing items', () => {
            table.splice(0, 0, [{ size: 10 }, { size: 15 }]);
            table.splice(1, 0, [{ size: 5 }, { size: 5 }]); // Insert 2 items
            assert.strictEqual(table.size(), 35);
        });
    });

    suite('indexAt', () => {
        test('should return -1 for invalid positions', () => {
            assert.strictEqual(table.indexAt(-1), -1);
        });

        test('should return the correct index for valid positions', () => {
            table.splice(0, 0, [{ size: 10 }, { size: 15 }]);
            assert.strictEqual(table.indexAt(0), 0);
            assert.strictEqual(table.indexAt(9), 0);
            assert.strictEqual(table.indexAt(10), 1);
            assert.strictEqual(table.indexAt(24), 1);
        });

        test('should return the correct index after splicing', () => {
            table.splice(0, 0, [{ size: 10 }, { size: 15 }]);
            table.splice(1, 0, [{ size: 5 }]); // Insert an item
            assert.strictEqual(table.indexAt(10), 1);
            assert.strictEqual(table.indexAt(15), 2);
        });
    });

    suite('indexAfter', () => {
        test('should return the next index for valid positions', () => {
            table.splice(0, 0, [{ size: 10 }, { size: 15 }]);
            assert.strictEqual(table.indexAfter(0), 1);
            assert.strictEqual(table.indexAfter(10), 2);
        });

        test('should return the total count if position exceeds last item', () => {
            table.splice(0, 0, [{ size: 10 }, { size: 15 }]);
            assert.strictEqual(table.indexAfter(25), table.count());
        });

        test('should handle empty table correctly', () => {
            assert.strictEqual(table.indexAfter(0), 0);
        });
    });

    suite('positionAt', () => {
        test('should return -1 for invalid indices', () => {
            assert.strictEqual(table.positionAt(-1), -1);
        });

        test('should return the correct position for valid indices', () => {
            table.splice(0, 0, [{ size: 10 }, { size: 15 }]);
            assert.strictEqual(table.positionAt(0), 0);
            assert.strictEqual(table.positionAt(1), 10);
        });

        test('should handle sparse ranges correctly', () => {
            table.splice(0, 0, [{ size: 10 }, { size: 15 }, { size: 5 }]);
            assert.strictEqual(table.positionAt(2), 25);
        });

        test('should return -1 for out-of-bound indices', () => {
            table.splice(0, 0, [{ size: 10 }, { size: 15 }]);
            assert.strictEqual(table.positionAt(5), -1);
        });
    });

    suite('splice', () => {
        test('should insert items correctly', () => {
            table.splice(0, 0, [{ size: 10 }, { size: 15 }]);
            assert.strictEqual(table.count(), 2);
            assert.strictEqual(table.size(), 25);
        });

        test('should remove items correctly', () => {
            table.splice(0, 0, [{ size: 10 }, { size: 15 }, { size: 20 }]);
            table.splice(1, 1); // Remove one item
            assert.strictEqual(table.count(), 2);
            assert.strictEqual(table.size(), 30);
        });

        test('should replace items correctly', () => {
            table.splice(0, 0, [{ size: 10 }, { size: 15 }]);
            table.splice(1, 1, [{ size: 5 }]); // Replace one item
            assert.strictEqual(table.count(), 2);
            assert.strictEqual(table.size(), 15);
        });

        test('should handle splicing at the beginning correctly', () => {
            table.splice(0, 0, [{ size: 10 }, { size: 15 }]);
            table.splice(0, 1, [{ size: 20 }]); // Replace the first item
            assert.strictEqual(table.count(), 2);
            assert.strictEqual(table.size(), 35);
        });

        test('should handle splicing at the end correctly', () => {
            table.splice(0, 0, [{ size: 10 }, { size: 15 }]);
            table.splice(2, 0, [{ size: 5 }]); // Insert at the end
            assert.strictEqual(table.count(), 3);
            assert.strictEqual(table.size(), 30);
        });

        test('should handle empty splice correctly', () => {
            table.splice(0, 0, [{ size: 10 }, { size: 15 }]);
            table.splice(1, 0); // No insert or delete
            assert.strictEqual(table.count(), 2);
            assert.strictEqual(table.size(), 25);
        });
    });

    suite('integration tests', () => {
        test('should handle complex splice operations correctly', () => {
            table.splice(0, 0, [{ size: 10 }, { size: 15 }]);
            table.splice(1, 1, [{ size: 20 }, { size: 5 }]); // Replace one with two
            table.splice(0, 1); // Remove the first item

            assert.strictEqual(table.count(), 2);
            assert.strictEqual(table.size(), 25);
            assert.strictEqual(table.indexAt(15), 0);
            assert.strictEqual(table.positionAt(1), 20);
        });

        test('should handle multiple insertions and deletions', () => {
            table.splice(0, 0, [{ size: 10 }]);
            table.splice(1, 0, [{ size: 15 }, { size: 20 }]); // Insert at end
            table.splice(1, 1); // Remove the middle item
            table.splice(2, 0, [{ size: 25 }]); // Insert at new end

            assert.strictEqual(table.count(), 3);
            assert.strictEqual(table.size(), 55);
        });

        test('should handle large datasets efficiently', () => {
            const largeData = Array.from({ length: 1000 }, (_, i) => ({ size: i + 1 }));
            table.splice(0, 0, largeData);

            assert.strictEqual(table.count(), 1000);
            assert.strictEqual(table.size(), (1000 * (1000 + 1)) / 2); // Sum of 1 to 1000

            table.splice(500, 100); // Remove 100 items
            assert.strictEqual(table.count(), 900);
        });
    });
});