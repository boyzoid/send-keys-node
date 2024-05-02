# SendKeys Node

A Node wrapper for the awesome [SendKeys](https://github.com/socsieng/sendkeys) library by [Soc Sieng](https://github.com/socsieng).

## Init the App

Once you haev cloned this repo, navigate to the project folder and run the command:

```shell
npm install
```

## Writing a Script

To create a 'script'' or command set, add a JSON file (the name does not matter) to the `command-sets` directory.

The file should have a JSON structure similar to structure in `command-set.json.template`

```javascript
{
  "name": "Command Set template",
  "commands": [
    {
      "title": "List Folder",
      "string": "ls<c:return>",
      "target": "terminal",
      "delay": 0.1,
      "initialDelay": 0.25
    },
    {
      "title": "Clear Console",
      "string": "clear<c:return>",
      "target": "terminal",
      "delay": 0.1,
      "initialDelay": 0.25
    }
  ]
}
```

* The `title` property is the name that will appear on the web interface.
* The `string` property contains the keystrokes you want to send.
* The `target` property is the app that will receive the keystrokes.
* The `delay` property is the length of time in between keystrokes in seconds.
* The `initialDelay` property is how long to delay sending the keystrokes to the app in seconds.

## Running the App

When you have your script (command set) completed, you start the app using the following command

```shell
npm run start
```

If you want to monitor the folder so that Node will refresh when shcanges are made to a script, run:

```shell
npm run monitor
```

## Open the App in a Browser

To use the web interface, navigate to [localhost:3000](http://localhost:3000)

**Note:** If you make changes to a script while, you will need to refresh the page to see these cahnges reflected in the browser.
