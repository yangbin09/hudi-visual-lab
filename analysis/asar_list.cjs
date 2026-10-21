const fs = require('fs');
const path = process.argv[2];
const needle = (process.argv[3] || '').toLowerCase();
const outFile = process.argv[4] || 'asar_files.txt';
const fd = fs.openSync(path, 'r');
const head = Buffer.alloc(16);
fs.readSync(fd, head, 0, 16, 0);
const jsonLen = head.readUInt32LE(12);
const buf = Buffer.alloc(jsonLen);
fs.readSync(fd, buf, 0, jsonLen, 16);
const text = buf.toString('utf8');
let header;
try { header = JSON.parse(text); } catch (e) {
  console.error('PARSE FAIL: ' + e.message.slice(0, 200));
  process.exit(2);
}
const out = [];
(function walk(node, prefix) {
  for (const [name, val] of Object.entries(node.files || {})) {
    const p = prefix + '/' + name;
    if (val.files) walk(val, p);
    else out.push({ p, size: val.size, offset: val.offset, unpacked: !!val.unpacked });
  }
})(header, '');
console.log('TOTAL FILES: ' + out.length);
const hits = needle ? out.filter(x => x.p.toLowerCase().includes(needle)) : out;
console.log('HITS: ' + hits.length);
for (const h of hits.slice(0, 300)) console.log(h.p + '\t' + h.size);
fs.writeFileSync(outFile, out.map(x => x.p + '\t' + x.size + '\t' + x.offset).join('\n'));
