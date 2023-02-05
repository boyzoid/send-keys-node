const express = require('express')
const router = express.Router()
const svc = require('../servcies/SendKeysService')
const sendKeysService = new svc()

router.get('/', function(req, res, next) {
  res.send({message: 'Node Demo main endpoint'})
});

router.get('/list', function(req, res, next) {
  res.send(sendKeysService.files);
});

router.post('/run', function(req, res, next) {
  res.send( sendKeysService.sendCommand(req.body))

});

module.exports = router;
