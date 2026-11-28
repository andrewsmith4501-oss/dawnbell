'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');

const ROOT_DIR = __dirname;
const DIST_DIR = path.join(ROOT_DIR, 'dist');

function createApp() {
  const app = express();
  app.disable('x-powered-by');

  if (fs.existsSync(DIST_DIR)) {
    app.use(express.static(DIST_DIR, { dotfiles: 'ignore' }));
  }
  app.use('/icons', express.static(path.join(ROOT_DIR, 'icons'), { dotfiles: 'ignore' }));

  app.get('/manifest.webmanifest', (_req, res) => {
    res.type('application/manifest+json');
    res.sendFile(path.join(ROOT_DIR, 'manifest.webmanifest'));
  });

  app.get('/', (_req, res) => {
    const builtIndex = path.join(DIST_DIR, 'index.html');
    res.sendFile(fs.existsSync(builtIndex) ? builtIndex : path.join(ROOT_DIR, 'index.html'));
  });

  app.use((_req, res) => {
    res.status(404).send('Not Found');
  });

  return app;
}

if (require.main === module) {
  const PORT = Number(process.env.PORT) || 3000;
  const HOST = '0.0.0.0';
  const app = createApp();
  app.listen(PORT, HOST, () => {
    console.log(`Dawnbell 3D server listening on http://${HOST}:${PORT}`);
  });
}

module.exports = { createApp };
