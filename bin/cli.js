#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const zlib = require('node:zlib');

// zstd frame magic number: 28 B5 2F FD (little-endian 0xFD2FB528)
const MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd]);

function findFrameStarts(buf) {
  const starts = [];
  for (let i = 0; ; ) {
    const idx = buf.indexOf(MAGIC, i);
    if (idx < 0) break;
    starts.push(idx);
    i = idx + 4;
  }
  return starts;
}

function extract(buf) {
  const starts = findFrameStarts(buf);
  const frames = [];
  let failed = 0;
  for (let k = 0; k < starts.length; k++) {
    const start = starts[k];
    const end = k + 1 < starts.length ? starts[k + 1] : buf.length;
    try {
      frames.push(zlib.zstdDecompressSync(buf.subarray(start, end)));
    } catch {
      failed += 1;
    }
  }
  return { starts: starts.length, frames, failed };
}

function usage() {
  console.log(
    'Usage: dsh-session-extract <session.v4.jsonl.zstd> [options]\n' +
    '\n' +
    'Options:\n' +
    '  -o, --out <file>   write output to a file instead of stdout\n' +
    '  -s, --stats        print frame/line statistics to stderr\n' +
    '  -h, --help         show this help'
  );
}

function main() {
  const argv = process.argv.slice(2);
  const opts = { file: null, out: null, stats: false };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') {
      usage();
      return;
    } else if (a === '-o' || a === '--out') {
      opts.out = argv[++i];
    } else if (a === '-s' || a === '--stats') {
      opts.stats = true;
    } else if (!opts.file) {
      opts.file = a;
    } else {
      console.error('Unexpected argument: ' + a);
      process.exitCode = 2;
      return;
    }
  }

  if (!opts.file) {
    usage();
    process.exitCode = 1;
    return;
  }
  if (!fs.existsSync(opts.file)) {
    console.error('No such file: ' + opts.file);
    process.exitCode = 1;
    return;
  }
  if (typeof zlib.zstdDecompressSync !== 'function') {
    console.error('This Node build has no zstd support. Node >= 22.15.0 is required.');
    process.exitCode = 1;
    return;
  }

  const buf = fs.readFileSync(opts.file);
  const { starts, frames, failed } = extract(buf);
  const text = frames.map((b) => b.toString('utf8')).join('');
  const lines = text.split('\n').filter((l) => l.length > 0);

  if (opts.out) {
    fs.writeFileSync(opts.out, text);
  } else {
    process.stdout.write(text);
  }

  if (opts.stats) {
    console.error(
      'frames=' + starts +
      ' decoded=' + frames.length +
      ' failed=' + failed +
      ' bytes=' + buf.length +
      ' lines=' + lines.length
    );
  }
}

main();
