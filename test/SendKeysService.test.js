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

test('Run All opts in commands in order and waits after each with a default of two seconds', async t => {
  const directory = withDirectory(t);
  const commands = [
    { title: 'First', target: 'Terminal', string: 'first', runAll: true, delay: 0 },
    { title: 'Manual', target: 'Terminal', string: 'manual' },
    { title: 'Excluded', target: 'Terminal', string: 'excluded', runAll: false },
    { title: 'Last', target: 'Terminal', string: 'last', runAll: true }
  ];
  writeSet(directory, 'set.json', { delay: 0.5, initialDelay: 0, commands });
  const events = [];
  let service;
  service = new SendKeysService({ directory,
    runner: (target, string, options) => { events.push({ string, ...options }); },
    wait: async milliseconds => {
      events.push(milliseconds);
      assert.throws(() => service.sendCommand({ setIndex: 0, commandIndex: 0 }), { status: 409 });
      assert.throws(() => service.reload(), { status: 409 });
      await assert.rejects(service.runAll({ setIndex: 0 }), { status: 409 });
    }
  });
  assert.deepEqual(await service.runAll({ setIndex: '0' }), { success: true, count: 2 });
  assert.deepEqual(events, [
    { string: 'first', delay: 0, initialDelay: 0 }, 2000,
    { string: 'last', delay: 0.5, initialDelay: 0 }, 2000
  ]);
  assert.equal(service.busy, false);
  writeSet(directory, 'set.json', { commands, runAllDelay: 0 });
  service.reload();
  events.length = 0;
  await service.runAll({ setIndex: 0 });
  assert.equal(events[1], 0);
  assert.equal(events[3], 0);
});

test('Run All validates selection and confirmation before sending, and stops on runner failure', async t => {
  const directory = withDirectory(t);
  writeSet(directory, 'set.json', { commands: [
    { title: 'First', target: 'Terminal', string: 'first', runAll: true },
    { title: 'Sensitive', target: 'Terminal', string: 'secret', runAll: true, sensitive: true },
    { title: 'Last', target: 'Terminal', string: 'last', runAll: true }
  ] });
  const calls = [];
  const service = new SendKeysService({ directory, wait: async () => {}, runner: (target, string) => {
    calls.push(string);
    if (string === 'secret') throw new Error('Permission denied');
  } });
  for (const setIndex of ['', -1, 3, null]) {
    await assert.rejects(service.runAll({ setIndex, confirmed: true }), { status: 400 });
  }
  await assert.rejects(service.runAll({ setIndex: 0 }), { status: 400 });
  assert.deepEqual(calls, []);
  await assert.rejects(service.runAll({ setIndex: 0, confirmed: true }), /Stopped at “Sensitive”: Permission denied/);
  assert.deepEqual(calls, ['first', 'secret']);
  assert.equal(service.busy, false);
  writeSet(directory);
  service.reload();
  await assert.rejects(service.runAll({ setIndex: 0, confirmed: true }), { status: 400 });
});

test('reload rejects invalid Run All properties', t => {
  const directory = withDirectory(t);
  for (const runAllDelay of [-1, '2', null]) {
    writeSet(directory, 'set.json', { runAllDelay });
    const service = new SendKeysService({ directory, runner: () => {} });
    assert.match(service.list().errors[0].message, /runAllDelay/);
  }
  writeSet(directory, 'set.json', { commands: [{ title: 'Test', target: 'Terminal', string: 'x', runAll: 'true' }] });
  const service = new SendKeysService({ directory, runner: () => {} });
  assert.match(service.list().errors[0].message, /runAll must be a boolean/);
});
