import assert from 'node:assert/strict';
import test from 'node:test';
import { renderMarkdown } from './markdown';

test('renders headings, bullet lists, inline code, and bold text', () => {
  const html = renderMarkdown('## WHERE\n\nGunakan **WHERE** untuk `filter` data.\n\n- Satu\n- Dua\n');

  assert.match(html, /<h2>WHERE<\/h2>/);
  assert.match(html, /<strong>WHERE<\/strong>/);
  assert.match(html, /<code>filter<\/code>/);
  assert.match(html, /<ul>/);
});
