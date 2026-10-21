const fs = require('fs');
const asarPath = process.argv[2];
const fd = fs.openSync(asarPath, 'r');
const head = Buffer.alloc(16);
fs.readSync(fd, head, 0, 16, 0);
const jsonLen = head.readUInt32LE(12);
const buf = Buffer.alloc(jsonLen);
fs.readSync(fd, buf, 0, jsonLen, 16);
const header = JSON.parse(buf.toString('utf8'));
const pkgs = new Set();
(function walk(node, prefix) {
  for (const [name, val] of Object.entries(node.files || {})) {
    const p = prefix + '/' + name;
    if (val.files) walk(val, p);
    else {
      const m = p.match(/^\/dsh\/node_modules\/((?:@[^/]+\/)?[^/]+)\/package\.json$/);
      if (m) pkgs.add(m[1]);
    }
  }
})(header, '');
console.log('PACKAGES ' + pkgs.size);
console.log([...pkgs].sort().join('\n'));
