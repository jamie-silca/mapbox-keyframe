const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8081;
const TILE_DIR = String.raw`C:\Users\jamie.barker\Desktop\GithubProjects\ortho-to-tiles-v1\processed_tiles\27022026`;

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.end('Method Not Allowed');
    return;
  }

  // Request URL format: /{z}/{x}/{y}.png
  // We need to map this to TILE_DIR/{z}/{x}/{y}.png
  const safePath = path.normalize(req.url).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(TILE_DIR, safePath);

  // Security check: ensure filePath is within TILE_DIR
  if (!filePath.startsWith(TILE_DIR)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.statusCode = 404;
        res.end('Not Found');
      } else {
        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    } else {
      res.setHeader('Content-Type', 'image/png');
      res.end(data);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Tile server running at http://localhost:${PORT}/`);
  console.log(`Serving tiles from: ${TILE_DIR}`);
});
