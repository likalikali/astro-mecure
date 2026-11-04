import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePostDate, resolvePostDates } from '../post-dates.js';

test('dates without offsets use Beijing time; explicit offsets are preserved', () => {
  assert.equal(normalizePostDate('2026-11-01'), '2026-10-31T16:00:00.000Z');
  assert.equal(normalizePostDate('2026-11-01 09:30:00'), '2026-11-01T01:30:00.000Z');
  assert.equal(normalizePostDate('2026-11-01T09:30:00+09:00'), '2026-11-01T00:30:00.000Z');
  assert.equal(normalizePostDate(new Date('2026-11-01T01:30:00Z')), '2026-11-01T01:30:00.000Z');
});

test('draft saves do not set first upload; publishing does and later edits preserve it', () => {
  const draft = resolvePostDates({ draft: true }, {}, new Date('2026-11-01T01:00:00Z'));
  assert.equal(draft.date, undefined);
  const published = resolvePostDates({ draft: false }, draft, new Date('2026-11-02T02:00:00Z'));
  assert.equal(published.createdDate, draft.createdDate);
  assert.equal(published.date, '2026-11-02T02:00:00.000Z');
  const edited = resolvePostDates({ draft: false, date: '', createdDate: '' }, published, new Date('2026-11-03T03:00:00Z'));
  assert.equal(edited.date, published.date);
  assert.equal(edited.createdDate, published.createdDate);
  assert.equal(edited.updateDate, '2026-11-03T03:00:00.000Z');
});

test('explicit dates can be configured and legacy posts keep their original date', () => {
  const post = resolvePostDates({ createdDate: '2026-10-01 09:00:00', date: '2026-11-01 10:00:00', updateDate: '2026-11-02 11:00:00' });
  assert.equal(post.createdDate, '2026-10-01T01:00:00.000Z');
  assert.equal(post.date, '2026-11-01T02:00:00.000Z');
  assert.equal(post.updateDate, '2026-11-02T03:00:00.000Z');
  const legacy = resolvePostDates({}, { date: new Date('2026-05-27T00:00:00Z') });
  assert.equal(legacy.createdDate, '2026-05-27T00:00:00.000Z');
  assert.equal(legacy.date, legacy.createdDate);
});

test('invalid dates are rejected before the article can be overwritten', () => {
  for (const value of ['bad date', '2026-02-30', '2026-13-01', '2026-11-01T27:00:00']) {
    assert.throws(() => resolvePostDates({ createdDate: value }));
  }
});
