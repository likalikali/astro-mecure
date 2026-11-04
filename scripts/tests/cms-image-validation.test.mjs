import test from 'node:test';
import assert from 'node:assert/strict';
import { detectImageMime, validateCmsImage, MAX_IMAGE_BYTES } from '../cms-image-validation.js';

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  Buffer.alloc(24),
]);
const jpeg = Buffer.concat([Buffer.from([255, 216, 255, 224]), Buffer.alloc(16)]);
const gif = Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(20)]);
const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 ')]);

test('accepts matching supported image signatures', () => {
  for (const [filename, mime, bytes] of [
    ['my-image.png', 'image/png', png],
    ['猫咪.jpeg', 'image/jpeg', jpeg],
    ['a.jpg', 'image/jpeg', jpeg],
    ['a.gif', 'image/gif', gif],
    ['a.webp', 'image/webp', webp],
  ]) {
    assert.equal(validateCmsImage({ filename, mime, bytes }).mime, mime);
    assert.equal(detectImageMime(bytes), mime);
  }
});

test('rejects extension spoofing and MIME spoofing', () => {
  assert.throws(() => validateCmsImage({ filename: 'fake.png', mime: 'image/png', bytes: jpeg }));
  assert.throws(() => validateCmsImage({ filename: 'fake.jpg', mime: 'image/png', bytes: jpeg }));
  assert.throws(() => validateCmsImage({ filename: 'evil.svg', mime: 'image/svg+xml', bytes: png }));
  assert.throws(() => validateCmsImage({ filename: 'image.avif', mime: 'image/avif', bytes: png }));
});

test('rejects empty, oversized and unknown bytes', () => {
  assert.throws(() => validateCmsImage({ filename: 'a.png', mime: 'image/png', bytes: Buffer.alloc(0) }));
  assert.throws(() => validateCmsImage({ filename: 'a.png', mime: 'image/png', bytes: Buffer.alloc(MAX_IMAGE_BYTES + 1) }));
  assert.throws(() => validateCmsImage({ filename: 'a.png', mime: 'image/png', bytes: Buffer.from('<svg>') }));
});

test('normalizes local filenames and strips HTML punctuation', () => {
  const { filename } = validateCmsImage({
    filename: 'C:\\users\\alice\\cute<dango>.png',
    mime: 'image/png',
    bytes: png,
  });
  assert.equal(filename, 'cute-dango-.png');
  assert.throws(() => validateCmsImage({ filename: '.png', mime: 'image/png', bytes: png }));
});
