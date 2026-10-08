const setSelect = document.querySelector('#command-set-list');
const searchInput = document.querySelector('#command-search');
const listEl = document.querySelector('#command-list');
const reloadButton = document.querySelector('#reload');
const statusEl = document.querySelector('#status');
const errorsEl = document.querySelector('#file-errors');
let commandSets = [];
let running = false;

function setStatus(message, kind = 'secondary') {
  statusEl.textContent = message;
  statusEl.className = `alert alert-${kind}`;
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const result = await response.json();
  if (!response.ok || result.success === false) {
    throw new Error(result.message || `Request failed (${response.status})`);
  }
  return result;
}

function showFileErrors(errors) {
  errorsEl.replaceChildren();
  errorsEl.hidden = errors.length === 0;
  if (!errors.length) return;
  const heading = document.createElement('strong');
  heading.textContent = `${errors.length} command file${errors.length === 1 ? '' : 's'} could not be loaded:`;
  const list = document.createElement('ul');
  list.className = 'mb-0 mt-2';
  for (const error of errors) {
    const item = document.createElement('li');
    item.textContent = `${error.file}: ${error.message}`;
    list.append(item);
  }
  errorsEl.append(heading, list);
}

function applyList(result) {
  commandSets = result.sets;
  setSelect.replaceChildren(new Option('Select a command set', ''));
  commandSets.forEach((set, index) => setSelect.add(new Option(set.name || `Command set ${index + 1}`, index)));
  if (commandSets.length === 1) setSelect.value = '0';
  showFileErrors(result.errors);
  renderCommands();
  setStatus(`${commandSets.length} command set${commandSets.length === 1 ? '' : 's'} ready.`, 'success');
}

function detail(parent, label, value) {
  const line = document.createElement('div');
  const strong = document.createElement('strong');
  strong.textContent = `${label}: `;
  line.append(strong, document.createTextNode(value));
  parent.append(line);
}

function renderCommands() {
  listEl.replaceChildren();
  if (setSelect.value === '') return;
  const setIndex = Number(setSelect.value);
  const set = commandSets[setIndex];
  if (!set) return;
  const query = searchInput.value.trim().toLowerCase();
  let count = 0;
  set.commands.forEach((command, commandIndex) => {
    if (query && !`${command.title} ${command.target}`.toLowerCase().includes(query)) return;
    count++;
    const column = document.createElement('div');
    column.className = 'col-md-6 col-lg-4';
    const card = document.createElement('article');
    card.className = 'card command-card shadow-sm';
    const body = document.createElement('div');
    body.className = 'card-body';
    const title = document.createElement('h2');
    title.className = 'h5 card-title';
    title.textContent = `${commandIndex + 1}. ${command.title}`;
    body.append(title);
    detail(body, 'Target', command.target);
    detail(body, 'Initial delay', `${command.initialDelay ?? set.initialDelay ?? 0.25} seconds`);
    detail(body, 'Key delay', `${command.delay ?? set.delay ?? 0.1} seconds`);
    const preview = document.createElement('details');
    preview.className = 'mt-3';
    const summary = document.createElement('summary');
    summary.textContent = 'Preview keystrokes';
    const code = document.createElement('pre');
    code.className = 'command-preview bg-light border rounded p-2 mt-2';
    code.textContent = command.string;
    preview.append(summary, code);
    body.append(preview);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-primary mt-3 run-command';
    button.textContent = command.sensitive ? 'Review and run' : 'Run command';
    button.disabled = running;
    button.addEventListener('click', () => runCommand(setIndex, commandIndex));
    body.append(button);
    card.append(body);
    column.append(card);
    listEl.append(column);
  });
  if (!count) {
    const empty = document.createElement('p');
    empty.className = 'text-muted';
    empty.textContent = query ? 'No commands match your search.' : 'This set has no commands.';
    listEl.append(empty);
  }
}

async function runCommand(setIndex, commandIndex) {
  const command = commandSets[setIndex]?.commands[commandIndex];
  if (!command || running) return;
  if (command.sensitive && !window.confirm(`Run “${command.title}” in ${command.target}?\n\nKeystrokes:\n${command.string}`)) return;
  running = true;
  reloadButton.disabled = true;
  document.querySelectorAll('.run-command').forEach(button => { button.disabled = true; });
  setStatus(`Running “${command.title}”…`);
  try {
    await requestJson('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ setIndex, commandIndex, confirmed: command.sensitive === true })
    });
    setStatus(`Finished “${command.title}”.`, 'success');
  } catch (error) {
    const permissionHelp = /permission|accessibility|assistive|not allowed|not authorized/i.test(error.message)
      ? ' Check macOS Privacy & Security → Accessibility and Automation permissions.' : '';
    setStatus(`SendKeys reported an error for “${command.title}”: ${error.message}${permissionHelp}`, 'danger');
  } finally {
    running = false;
    reloadButton.disabled = false;
    document.querySelectorAll('.run-command').forEach(button => { button.disabled = false; });
  }
}

async function reload() {
  reloadButton.disabled = true;
  setStatus('Loading command sets…');
  try {
    applyList(await requestJson('/api/reload', { method: 'POST' }));
  } catch (error) {
    setStatus(`Could not load command sets: ${error.message}`, 'danger');
  } finally {
    reloadButton.disabled = running;
  }
}

setSelect.addEventListener('change', renderCommands);
searchInput.addEventListener('input', renderCommands);
reloadButton.addEventListener('click', reload);
requestJson('/api/list').then(applyList).catch(error => setStatus(`Could not load command sets: ${error.message}`, 'danger'));
requestJson('/api/setup').then(result => {
  document.querySelector('#platform-status').textContent = result.supported
    ? 'macOS detected. If keystrokes fail, check the permissions below.'
    : `This server is running on ${result.platform}; sending keystrokes requires macOS.`;
}).catch(() => {
  document.querySelector('#platform-status').textContent = 'Could not check the server platform.';
});
