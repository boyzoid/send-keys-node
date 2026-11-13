const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const app = require('../app');
const { createRouter } = require('../routes/api');

test('HTTP accepts local requests and rejects cross-origin or malformed run requests', async t => {
  const server = app.listen(0, '127.0.0.1');
  t.after(() => server.close());
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  const list = await fetch(`${base}/api/list`);
  assert.equal(list.status, 200);
  assert.ok(Array.isArray((await list.json()).sets));

  const setup = await fetch(`${base}/api/setup`);
  assert.equal((await setup.json()).platform, process.platform);

  const wrongOrigin = await fetch(`${base}/api/reload`, { method: 'POST', headers: { Origin: 'http://evil.example' } });
  assert.equal(wrongOrigin.status, 403);

  const wrongHostStatus = await new Promise((resolve, reject) => {
    http.get(`${base}/api/list`, { headers: { Host: 'evil.example' } }, response => {
      response.resume();
      resolve(response.statusCode);
    }).on('error', reject);
  });
  assert.equal(wrongHostStatus, 403);

  const badType = await fetch(`${base}/api/run`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{}' });
  assert.equal(badType.status, 415);

  const badIndex = await fetch(`${base}/api/run`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ setIndex: -1, commandIndex: 0 })
  });
  assert.equal(badIndex.status, 400);
});

test('run API reports synchronous completion and errors', async t => {
  let shouldFail = false;
  const fakeService = {
    sendCommand: () => {
      if (shouldFail) throw new Error('Permission denied');
      return { success: true };
    }
  };
  const testApp = express();
  testApp.use(express.json());
  testApp.use('/api', createRouter(fakeService));
  const server = testApp.listen(0, '127.0.0.1');
  t.after(() => server.close());
  await new Promise(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/run`;
  const options = {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
  };
  const success = await fetch(url, options);
  assert.equal(success.status, 200);
  assert.deepEqual(await success.json(), { success: true });
  shouldFail = true;
  const failure = await fetch(url, options);
  assert.equal(failure.status, 500);
  assert.match((await failure.json()).message, /Permission denied/);
});

test('Run All API awaits completion and reports validation and execution failures', async t => {
  let release;
  let failure;
  let received;
  const fakeService = {
    runAll: async data => {
      received = data;
      if (failure) throw failure;
      await new Promise(resolve => { release = resolve; });
      return { success: true, count: 2 };
    }
  };
  const testApp = express();
  testApp.use(express.json());
  testApp.use('/api', createRouter(fakeService));
  const server = testApp.listen(0, '127.0.0.1');
  t.after(() => server.close());
  await new Promise(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/run-all`;
  const badType = await fetch(url, { method: 'POST', body: '{}' });
  assert.equal(badType.status, 415);
  const options = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ setIndex: 0, confirmed: true }) };
  const pending = fetch(url, options);
  while (!release) await new Promise(resolve => setTimeout(resolve, 5));
  assert.deepEqual(received, { setIndex: 0, confirmed: true });
  release();
  const response = await pending;
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true, count: 2 });
  failure = Object.assign(new Error('Already running'), { status: 409 });
  assert.equal((await fetch(url, options)).status, 409);
  failure = new Error('SendKeys failed');
  const failed = await fetch(url, options);
  assert.equal(failed.status, 500);
  assert.match((await failed.json()).message, /SendKeys failed/);
});
