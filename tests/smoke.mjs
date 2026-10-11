import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import search from '../api/search.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
function response() {
  return {
    statusCode: 200,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    setHeader(key, val) { this.headers[key] = val; },
    json(data) { this.body = data; return this; }
  };
}

test('PWA essential assets and manifest exist', () => {
  const paths = ['index.html', 'styles.css', 'app.js', 'sw.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];
  for (const path of paths) assert.ok(existsSync(join(root, 'public', path)), `${path} missing`);
  const manifest = JSON.parse(readFileSync(join(root, 'public', 'manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, './');
  assert.ok(readFileSync(join(root, 'public', 'styles.css'), 'utf8').includes('[hidden]{display:none!important}'));
});

test('search endpoint validates input', async () => {
  const res = response();
  await search({method:'GET', query:{brand:'other', mode:'title', keyword:'abc'}}, res);
  assert.equal(res.statusCode, 400);
  const method = response();
  await search({method:'POST', query:{}}, method);
  assert.equal(method.statusCode, 405);
});

test('search endpoint passes TJ query and returns structured data', async () => {
  const original = globalThis.fetch;
  let query;
  globalThis.fetch = async (url) => {
    query = new URL(url);
    return {ok:true, json:async () => ({data:[{brand:'tj',title:'테스트곡',singer:'테스트가수',no:'10001'}], total:{row:1,page:1}})};
  };
  try {
    const res = response();
    await search({method:'GET', query:{brand:'tj',mode:'title',keyword:'테스트곡',page:'1'}},res);
    assert.equal(res.statusCode, 200);
    assert.equal(query.searchParams.get('brand'),'tj');
    assert.equal(query.searchParams.get('title'),'테스트곡');
    assert.equal(query.searchParams.get('limit'),'20');
    assert.equal(res.body.data[0].no,'10001');
  } finally { globalThis.fetch = original; }
});

test('search endpoint reports upstream errors without invented results', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('offline'); };
  try {
    const res = response();
    await search({method:'GET',query:{brand:'kumyoung',mode:'singer',keyword:'가수'}}, res);
    assert.equal(res.statusCode,502);
    assert.ok(res.body.error);
    assert.equal(res.body.data, undefined);
  } finally { globalThis.fetch = original; }
});
