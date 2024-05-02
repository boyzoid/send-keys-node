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

    sendCommand(data){
        let ret = {success: true}
        try{
            const set = this._files[data.setIndex]
            const command = set.commands[data.commandIndex]
            const delay = command.delay || set.delay || 0.1
            const initialDelay = command.initialDelay || set.initialDelay || .25
            console.log(command)
            sendKeys(command.target, command.string, { delay: delay, initialDelay: initialDelay })
        }
        catch (e){
            ret = {success: false, message: e.message}
        }
        return ret
    }
}

module.exports = SendKeysService