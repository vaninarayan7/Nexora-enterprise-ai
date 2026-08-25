import test from 'node:test';
import assert from 'node:assert/strict';

import { sanitizeDocumentText, chunkDocumentText, validateDocumentContent, buildIndexPayload } from '../src/lib/documentIndexing.js';

test('markdown content is cleaned and not empty before chunking', () => {
  const input = '# Title\n\n- item 1\n- item 2\n\n```js\nconst x = 1;\n```';
  const cleaned = sanitizeDocumentText(input, 'test.md');

  assert.ok(cleaned.length > 0);
  assert.ok(!cleaned.includes('```'));
  assert.ok(!cleaned.includes('```js'));
  assert.ok(cleaned.includes('Title'));
  assert.ok(cleaned.includes('item 1'));
});

test('chunking never creates empty chunks and preserves metadata', () => {
  const text = 'Alpha beta gamma delta epsilon. Zeta eta theta iota kappa lambda.';
  const chunks = chunkDocumentText(text, { maxChunkSize: 40, overlap: 10, docId: 'doc-1', docName: 'test.txt' });

  assert.ok(chunks.length > 0);
  assert.ok(chunks.every(chunk => chunk.text.trim().length > 0));
  assert.ok(chunks.every(chunk => chunk.docId === 'doc-1'));
  assert.ok(chunks.every(chunk => typeof chunk.chunkIndex === 'number'));
});

test('empty content is rejected before indexing', () => {
  const validation = validateDocumentContent('', 'sample.txt');
  assert.equal(validation.valid, false);
  assert.match(validation.error || '', /empty|unsupported/i);
});

test('index payload includes document and metadata fields', () => {
  const payload = buildIndexPayload({ docId: 'doc-1', name: 'report.pdf', content: 'Test content for indexing.' });
  assert.equal(payload.docId, 'doc-1');
  assert.equal(payload.fileType, 'pdf');
  assert.ok(Array.isArray(payload.chunks));
  assert.ok(payload.chunks.length > 0);
});
