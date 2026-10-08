const express = require('express');
const SendKeysService = require('../services/SendKeysService');

function createRouter(service = new SendKeysService()) {
  const router = express.Router();

  router.get('/list', (req, res) => res.json(service.list()));
  router.get('/setup', (req, res) => res.json({ platform: process.platform, supported: process.platform === 'darwin' }));

  router.post('/reload', (req, res) => {
    try {
      res.json(service.reload());
    } catch (error) {
      res.status(error.status || 500).json({ success: false, message: error.message });
    }
  });

  router.post('/run', (req, res) => {
    if (!req.is('application/json')) {
      return res.status(415).json({ success: false, message: 'Send a JSON request' });
    }
    try {
      res.json(service.sendCommand(req.body));
    } catch (error) {
      res.status(error.status || 500).json({ success: false, message: error.message || 'Command failed without details' });
    }
  });

  return router;
}

module.exports = createRouter();
module.exports.createRouter = createRouter;
