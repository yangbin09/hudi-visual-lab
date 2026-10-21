const fs = require('fs');
const lines = fs.readFileSync('asar_files.txt', 'utf8').split(/\r?\n/).filter(Boolean);
const pats = [/phone/i, /mobile/i, /android/i, /adb/i, /pair/i, /remote/i, /tunnel/i, /connect/i, /qr/i];
const hits = [];
for (const l of lines) {
  const f = l.split('\t')[0];
  if (pats.some(p => p.test(f))) hits.push(f);
}
fs.writeFileSync('names_hits.txt', 'HITS ' + hits.length + '\n' + hits.join('\n'));
