const fs = require('fs');
const asarPath = process.argv[2];
const target = process.argv[3];
const outPath = process.argv[4] || null;
const fd = fs.openSync(asarPath, 'r');
const head = Buffer.alloc(16);
fs.readSync(fd, head, 0, 16, 0);
const jsonLen = head.readUInt32LE(12);
const buf = Buffer.alloc(jsonLen);
fs.readSync(fd, buf, 0, jsonLen, 16);
const header = JSON.parse(buf.toString('utf8'));
const contentStart = 16 + jsonLen;
const out = [];
(function walk(node, prefix) {
  for (const [name, val] of Object.entries(node.files || {})) {
    const p = prefix + '/' + name;
    if (val.files) walk(val, p);
    else out.push({ p, size: val.size, offset: Number(val.offset), unpacked: !!val.unpacked });
  }
})(header, '');
if (!target) { console.log('need target'); process.exit(1); }
const exact = out.filter(x => x.p === target)[0];
const matches = exact ? [exact] : out.filter(x => x.p.includes(target));
if (!matches.length) { console.log('NOT FOUND: ' + target); process.exit(1); }
if (matches.length > 1 && !exact) {
  console.log('MULTIPLE: ' + matches.length);
  for (const m of matches.slice(0, 40)) console.log(m.p + '\t' + m.size);
  process.exit(3);
}
const m = matches[0];
const data = Buffer.alloc(m.size);
fs.readSync(fd, data, 0, m.size, contentStart + m.offset);
if (outPath) { fs.writeFileSync(outPath, data); console.log('WROTE ' + m.p + ' -> ' + outPath + ' (' + m.size + ' bytes)'); }
else { process.stdout.write(data.toString('utf8')); }
