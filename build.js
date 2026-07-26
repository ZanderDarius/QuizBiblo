const fs = require('fs');
const path = require('path');

const root = __dirname;
const dist = path.join(root, 'dist');
const template = fs.readFileSync(path.join(root, 'worker', 'sites-worker.js'), 'utf8');
const assets = {
  __INDEX_HTML__: fs.readFileSync(path.join(root, 'index.html'), 'utf8'),
  __STYLES_CSS__: fs.readFileSync(path.join(root, 'styles.css'), 'utf8'),
  __SCRIPT_JS__: fs.readFileSync(path.join(root, 'script.js'), 'utf8'),
};

const worker = Object.entries(assets).reduce(
  (source, [placeholder, content]) => source.split(placeholder).join(JSON.stringify(content)),
  template,
);

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, 'server'), { recursive: true });
fs.mkdirSync(path.join(dist, '.openai'), { recursive: true });
fs.writeFileSync(path.join(dist, 'server', 'index.js'), worker);
fs.writeFileSync(path.join(dist, 'package.json'), '{"type":"module"}\n');
fs.copyFileSync(
  path.join(root, '.openai', 'hosting.json'),
  path.join(dist, '.openai', 'hosting.json'),
);

console.log('Built Sites worker at dist/server/index.js');
