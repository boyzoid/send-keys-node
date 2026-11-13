# SendKeys Node

A local web interface for saved macOS keystroke commands, powered by [sendkeys-macos](https://github.com/socsieng/sendkeys-macos).

## Set up

Use Node.js 18 or newer on the Mac that will receive the keystrokes.

```sh
npm install
npm start
```

Open <http://localhost:3000>. The server listens on `127.0.0.1` only. The browser must run on the same Mac.

macOS may prompt you to allow the terminal or Node process to control other apps. If a command fails, check **System Settings → Privacy & Security → Accessibility** and **Automation**. Grant access only to the process you use to start this app.

## Command sets

Put a `.json` file in `command-sets` for each set. See `command-sets/command-set.json.template` for an example. Each command needs a `title`, `target` app name, and `string` of keystrokes. Set level and command level `delay` and `initialDelay` are optional numbers of seconds; command values take priority, and `0` is valid.

```json
{
  "name": "Terminal examples",
  "commands": [
    {
      "title": "List folder",
      "target": "Terminal",
      "string": "ls<c:return>",
      "delay": 0.1,
      "initialDelay": 0.25
    },
    {
      "title": "Clear console",
      "target": "Terminal",
      "string": "clear<c:return>",
      "sensitive": true
    }
  ]
}
```

Set `sensitive: true` on a command to require confirmation in the interface and in the run API. Use **Reload files** after editing a JSON file; malformed files are listed in the interface while valid sets remain available. Search filters the commands in the selected set, and **Preview keystrokes** shows the exact saved string.

Only put commands you trust in this directory. The app types their keystrokes into another application, and command strings are visible to anyone who can use the local interface. Do not store passwords or other secrets in command sets.

Use **Run All** to send commands with `"runAll": true` in their JSON order. Commands with `false` or no `runAll` property remain available individually. Search does not change the sequence. The set-level `"runAllDelay": 2` controls the pause in seconds after each command finishes, including the last; it defaults to 2 and accepts 0. This is separate from the keystroke `delay` and `initialDelay` settings.

Run All confirms any included sensitive commands before starting and prevents other runs or reloads during the sequence. A SendKeys failure stops the sequence; errors printed by the target application (such as an intentional SQL constraint error) do not stop it. Keep the page open until it finishes; closing it does not cancel the server sequence. The inventory demo includes its first eight commands and leaves the final reset manual.

## Development

```sh
npm test
```

The run API accepts the existing `setIndex` and `commandIndex` fields. A command with `sensitive: true` also needs `confirmed: true`. SendKeys runs synchronously on the main Node thread. The server responds when the command finishes, so other requests wait while it runs.

`POST /api/run-all` accepts a JSON body with `setIndex` and, if included commands are sensitive, `confirmed: true`. It responds with `{ "success": true, "count": 8 }` after the sequence and its pauses finish. Pauses allow other requests, while individual SendKeys calls still run synchronously.
