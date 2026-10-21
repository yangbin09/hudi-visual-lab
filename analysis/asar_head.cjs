const fs = require('fs');
const p = process.argv[2];
const fd = fs.openSync(p, 'r');
const head = Buffer.alloc(32);
fs.readSync(fd, head, 0, 32, 0);
console.log('HEX: ' + head.toString('hex').match(/.{1,8}/g).join(' '));
console.log('u32@0=' + head.readUInt32LE(0) + ' u32@4=' + head.readUInt32LE(4) + ' u32@8=' + head.readUInt32LE(8) + ' u32@12=' + head.readUInt32LE(12));
console.log('ascii: ' + JSON.stringify(head.toString('latin1')));
