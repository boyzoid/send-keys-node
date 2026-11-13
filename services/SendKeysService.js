const fs = require('node:fs');
const path = require('node:path');
const sendKeys = require('sendkeys-macos');
const { setTimeout: sleep } = require('node:timers/promises');

function validateDelay(value, label) {
  if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) {
    throw new Error(`${label} must be a non-negative number`);
  }
}

function validateSet(set) {
  if (!set || typeof set !== 'object' || Array.isArray(set)) throw new Error('Expected a command set object');
  if (set.name !== undefined && typeof set.name !== 'string') throw new Error('name must be a string');
  if (!Array.isArray(set.commands)) throw new Error('commands must be an array');
  validateDelay(set.delay, 'delay');
  validateDelay(set.initialDelay, 'initialDelay');
  validateDelay(set.runAllDelay, 'runAllDelay');
  set.commands.forEach((command, index) => {
    const label = `commands[${index}]`;
    if (!command || typeof command !== 'object' || Array.isArray(command)) throw new Error(`${label} must be an object`);
    for (const field of ['title', 'target', 'string']) {
      if (typeof command[field] !== 'string' || !command[field].trim()) {
        throw new Error(`${label}.${field} must be a non-empty string`);
      }
    }
    if (command.sensitive !== undefined && typeof command.sensitive !== 'boolean') {
      throw new Error(`${label}.sensitive must be a boolean`);
    }
    if (command.runAll !== undefined && typeof command.runAll !== 'boolean') {
      throw new Error(`${label}.runAll must be a boolean`);
    }
    validateDelay(command.delay, `${label}.delay`);
    validateDelay(command.initialDelay, `${label}.initialDelay`);
  });
}

class SendKeysService {
  constructor({ directory = path.join(__dirname, '..', 'command-sets'), runner = sendKeys, wait = sleep } = {}) {
    this.directory = directory;
    this.runner = runner;
    this.wait = wait;
    this.files = [];
    this.errors = [];
    this.busy = false;
    this.reload();
  }

  reload() {
    if (this.busy) {
      const error = new Error('Wait for the current command to finish before reloading');
      error.status = 409;
      throw error;
    }
    const files = [];
    const errors = [];
    for (const filename of fs.readdirSync(this.directory).filter(name => name.endsWith('.json')).sort()) {
      try {
        const set = JSON.parse(fs.readFileSync(path.join(this.directory, filename), 'utf8'));
        validateSet(set);
        files.push(set);
      } catch (error) {
        errors.push({ file: filename, message: error.message });
      }
    }
    this.files = files;
    this.errors = errors;
    return this.list();
  }

  list() {
    return { sets: this.files, errors: this.errors };
  }

  sendCommand(data) {
    if (this.busy) {
      const error = new Error('Another command is already running');
      error.status = 409;
      throw error;
    }
    const parseIndex = value => (typeof value === 'number' ||
      (typeof value === 'string' && /^\d+$/.test(value))) ? Number(value) : NaN;
    const setIndex = parseIndex(data?.setIndex);
    const commandIndex = parseIndex(data?.commandIndex);
    if (!Number.isInteger(setIndex) || !Number.isInteger(commandIndex) ||
        setIndex < 0 || commandIndex < 0 ||
        !this.files[setIndex]?.commands[commandIndex]) {
      const error = new Error('Select a valid command');
      error.status = 400;
      throw error;
    }
    const set = this.files[setIndex];
    const command = set.commands[commandIndex];
    if (command.sensitive && data.confirmed !== true) {
      const error = new Error('This command requires confirmation');
      error.status = 400;
      throw error;
    }
    this.busy = true;
    try {
      this.execute(set, command);
      return { success: true };
    } finally {
      this.busy = false;
    }
  }

  execute(set, command) {
    this.runner(command.target, command.string, {
      delay: command.delay ?? set.delay ?? 0.1,
      initialDelay: command.initialDelay ?? set.initialDelay ?? 0.25
    });
  }

  async runAll(data) {
    if (this.busy) {
      const error = new Error('Another command is already running');
      error.status = 409;
      throw error;
    }
    const value = data?.setIndex;
    const index = (typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value))) ? Number(value) : NaN;
    const set = Number.isInteger(index) && index >= 0 ? this.files[index] : undefined;
    const commands = set?.commands.filter(command => command.runAll === true);
    if (!commands?.length) {
      const error = new Error('Select a valid set with commands included in Run All');
      error.status = 400;
      throw error;
    }
    if (commands.some(command => command.sensitive) && data.confirmed !== true) {
      const error = new Error('This sequence requires confirmation');
      error.status = 400;
      throw error;
    }
    this.busy = true;
    try {
      for (const command of commands) {
        try {
          this.execute(set, command);
        } catch (error) {
          throw new Error(`Stopped at “${command.title}”: ${error.message || 'Command failed without details'}`);
        }
        await this.wait((set.runAllDelay ?? 2) * 1000);
      }
      return { success: true, count: commands.length };
    } finally {
      this.busy = false;
    }
  }
}

module.exports = SendKeysService;
