let commandSetList = []

init = function (){
    const commandSetListEl = document.querySelector('#command-set-list')
    commandSetListEl.addEventListener('change', commandSetSelected)
    getMyScripts()
}

getMyScripts = async function (){
    await fetch('/api/list')
        .then((response) => response.json())
        .then((list) => setList( list ));
}

commandSetSelected = function(evt){
    const idx = evt.target.value
    const commandListEl = document.querySelector('#command-list')
    commandListEl.innerHTML = ''
    let str = ''
    if(idx > -1){
        const cmdList = commandSetList[idx].commands
        for(let cdx in cmdList){
            str += getCommandTemplate(cdx, cmdList[cdx])
        }
        commandListEl.innerHTML = str
        const btnEls = document.querySelectorAll('.run-cmd')
        for(let btn of btnEls)
            btn.addEventListener('click', sendCommand)
    }
    else{
        commandListEl.innerHTML = ''
    }
}

getCommandTemplate = function (cdx, cmd){
    return `<div class="col">
    <div class="card mb-4 rounded-3 shadow-sm">
      <div class="card-header py-3">
        <h4 class="my-0 fw-normal">${cmd.title}</h4>
      </div>
      <div class="card-body">
        <div class="text-bold">Target: ${cmd.target}</div>
        <button type="button" idx="${cdx}" class="btn btn-sm btn-primary run-cmd">Run Command</button>
      </div>
    </div>
  </div>`
}

sendCommand = async function(evt){
    let cdx = evt.target.getAttribute('idx')
    let idx = document.querySelector('#command-set-list').value
    let result = await fetch('/api/run',{
        method: "POST",
        body: JSON.stringify(commandSetList[idx].commands[cdx]),
        headers: {
            'Content-Type': 'application/json'
        },
    })
        .then((data) => console.log(data))
}

setList = function( list ){
    commandSetList = list
    const commandSetListEl = document.querySelector('#command-set-list')
    for(let idx in commandSetList ){
        let newEl = document.createElement('option')
        newEl.value = idx
        newEl.textContent = commandSetList[idx].name || `Command Set ${idx+1}`
        commandSetListEl.appendChild(newEl)
    }
}

window.onload = init;