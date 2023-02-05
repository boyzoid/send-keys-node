const fs = require('fs');
const sendKeys = require('sendkeys-macos');

class SendKeysService{
    constructor(){
        this._files = []
        const files = fs.readdirSync('command-sets')
        files.forEach(file => {
            if (file.slice(-4)== "json"){
                this._files.push(JSON.parse(fs.readFileSync(`command-sets/${file}`)))
            }

        })
    }

    get files(){
        return this._files
    }

    sendCommand( command){
        let ret = {success: true}
        try{
            const delay = command.delay || 0.1
            const initialDelay = command.initialDelay | .25
            sendKeys(command.target, command.string, { delay: delay, initialDelay: initialDelay })
        }
        catch (e){
            ret = {success: false, message: e.message}
        }
        return ret
    }
}

module.exports = SendKeysService