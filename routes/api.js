const express = require('express');
const router = express.Router();
const fs = require('fs');
const sendKeys = require('sendkeys-macos');

router.get('/', function(req, res, next) {
  res.send({message: 'Node Demo main endpoint'});
});

router.get('/list', function(req, res, next) {
  let result = []
  const files = fs.readdirSync('key-scripts')
  for(let file of files){
    result.push(JSON.parse(fs.readFileSync(`key-scripts/${file}`)) )
  }
  console.log(files)
  res.send(result);
});

router.post('/run', function(req, res, next) {
  let success = true
  let command = req.body
  console.log(req.body)
  console.log(command.target === 'Tabby')

  try{

    sendKeys(command.target, command.string, { delay: 0.1, initialDelay: .25 })
    res.send({success: success});
  }
  catch (e){
    success = false
    res.send({message: e.message});
  }

});


module.exports = router;
