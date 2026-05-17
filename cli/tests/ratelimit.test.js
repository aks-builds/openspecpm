import test from 'node:test';
import assert from 'node:assert/strict';
import { TokenBucket } from '../src/ratelimit.js';

test('tryTake succeeds within capacity, fails beyond', () => {
  const b = new TokenBucket({ capacity: 3, refillPerSec: 1 });
  assert.equal(b.tryTake(), true);
  assert.equal(b.tryTake(), true);
  assert.equal(b.tryTake(), true);
  assert.equal(b.tryTake(), false);
});

test('tokens refill over time', async () => {
  const b = new TokenBucket({ capacity: 2, refillPerSec: 50 }); // fast refill for test speed
  assert.equal(b.tryTake(2), true);
  assert.equal(b.tryTake(), false);
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(b.tryTake(), true);
});

test('constructor rejects invalid args', () => {
  assert.throws(() => new TokenBucket({ capacity: 0, refillPerSec: 1 }));
  assert.throws(() => new TokenBucket({ capacity: 1, refillPerSec: -1 }));
});
