const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const SendKeysService = require('../services/SendKeysService');

function withDirectory(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sendkeys-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function writeSet(directory, filename = 'set.json', overrides = {}) {
  const set = {
    name: 'Examples',
    commands: [{ title: 'Clear', target: 'Terminal', string: 'clear<c:return>', sensitive: true }],
    ...overrides
  };
  fs.writeFileSync(path.join(directory, filename), JSON.stringify(set));
}

test('reload keeps valid sets and reports invalid files', t => {
  const directory = withDirectory(t);
  writeSet(directory);
  fs.writeFileSync(path.join(directory, 'broken.json'), '{');
  const service = new SendKeysService({ directory, runner: () => {} });
  assert.equal(service.list().sets.length, 1);
  assert.equal(service.list().errors.length, 1);
  assert.equal(service.list().errors[0].file, 'broken.json');
  fs.writeFileSync(path.join(directory, 'broken.json'), JSON.stringify({ commands: [{ title: 'Bad' }] }));
  assert.match(service.reload().errors[0].message, /target/);
  fs.writeFileSync(path.join(directory, 'broken.json'), JSON.stringify({ commands: [] }));
  assert.equal(service.reload().sets.length, 2);
  assert.equal(service.list().errors.length, 0);
});

test('run validates indices, requires confirmation, and preserves zero delays', t => {
  const directory = withDirectory(t);
  writeSet(directory, 'set.json', { delay: 1, initialDelay: 2,
    commands: [{ title: 'Clear', target: 'Terminal', string: 'clear<c:return>', sensitive: true, delay: 0, initialDelay: 0 }] });
  const calls = [];
  const service = new SendKeysService({ directory, runner: (target, string, options) => { calls.push({ target, string, ...options }); } });
  assert.throws(() => service.sendCommand({ setIndex: '', commandIndex: 0 }), { status: 400 });
  assert.throws(() => service.sendCommand({ setIndex: 0, commandIndex: 7 }), { status: 400 });
  assert.throws(() => service.sendCommand({ setIndex: 0, commandIndex: 0 }), { status: 400 });
  assert.deepEqual(service.sendCommand({ setIndex: '0', commandIndex: '0', confirmed: true }), { success: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].delay, 0);
  assert.equal(calls[0].initialDelay, 0);
});

test('synchronous execution blocks reentrant commands and releases the slot after failure', t => {
  const directory = withDirectory(t);
  writeSet(directory, 'set.json', { commands: [{ title: 'Run', target: 'Terminal', string: 'x' }] });
  let service;
  service = new SendKeysService({ directory, runner: () => {
    assert.throws(() => service.sendCommand({ setIndex: 0, commandIndex: 0 }), { status: 409 });
    assert.throws(() => service.reload(), { status: 409 });
    throw new Error('Permission denied');
  } });
  assert.throws(() => service.sendCommand({ setIndex: 0, commandIndex: 0 }), /Permission denied/);
  assert.equal(service.busy, false);
});

test('SendKeys completes on the main thread with a successful automation subprocess', t => {
  const directory = withDirectory(t);
  writeSet(directory, 'set.json', { commands: [{ title: 'Test', target: 'Test', string: 'x' }] });
  fs.writeFileSync(path.join(directory, 'osascript'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  const script = `const Service = require(${JSON.stringify(path.join(__dirname, '..', 'services', 'SendKeysService.js'))});
    const result = new Service({ directory: ${JSON.stringify(directory)} }).sendCommand({ setIndex: 0, commandIndex: 0 });
    process.stdout.write(JSON.stringify(result));`;
  const result = spawnSync(process.execPath, ['-e', script], {
    env: { ...process.env, PATH: `${directory}${path.delimiter}${process.env.PATH}` },
    encoding: 'utf8'
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '{"success":true}');
});
