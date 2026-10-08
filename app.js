const express = require('express');
const path = require('node:path');
const logger = require('morgan');
const apiRouter = require('./routes/api');

const app = express();

app.use((req, res, next) => {
  const host = req.get('host');
  let hostname;
  try {
    hostname = new URL(`http://${host}`).hostname;
  } catch {
    return res.status(403).json({ message: 'Invalid host' });
  }
  if (!['localhost', '127.0.0.1', '[::1]'].includes(hostname)) {
    return res.status(403).json({ message: 'Local requests only' });
  }
  const origin = req.get('origin');
  if (origin) {
    try {
      const url = new URL(origin);
      if (url.protocol !== 'http:' || url.host !== host) {
        return res.status(403).json({ message: 'Cross-origin requests are not allowed' });
      }
    } catch {
      return res.status(403).json({ message: 'Invalid origin' });
    }
  }
  if (req.get('sec-fetch-site') === 'cross-site') {
    return res.status(403).json({ message: 'Cross-site requests are not allowed' });
  }
  next();
});
app.use(logger('dev'));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api', apiRouter);

module.exports = app;
