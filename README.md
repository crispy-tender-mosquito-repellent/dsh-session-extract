# dsh-session-extract

Read every zstd frame from a DeepSeek Harness `.jsonl.zstd` session log.

## Why this exists

DeepSeek Harness stores each session as `session.v4.jsonl.zstd`. The file is not a
single zstd stream — it is a chain of independent zstd frames, one appended per
batch of messages. A normal decompressor reads only the first frame and then
stops, so you get a tiny fragment of the log instead of the whole thing.

The measured difference on a real 20 MB session:

| approach | result |
| --- | --- |
| `zlib.zstdDecompressSync(file)` (first frame only) | 234 bytes, 1 line |
| every frame (this tool) | 3,876 frames, 7,027 lines, 0 failures, 59.5 MB of jsonl |

This is not a bug in your decompressor. It is how the file is written.

## Install

```sh
npx dsh-session-extract <path/to/session.v4.jsonl.zstd>
```

or

```sh
npm install -g dsh-session-extract
```

Requires Node.js >= 22.15.0 (the version where `node:zlib` gained zstd support).

## Usage

```sh
# write the recovered jsonl to stdout
npx dsh-session-extract ./session.v4.jsonl.zstd > session.jsonl

# write to a file
npx dsh-session-extract ./session.v4.jsonl.zstd --out session.jsonl

# print frame / line / failure counts to stderr
npx dsh-session-extract ./session.v4.jsonl.zstd --stats --out session.jsonl
```

## How it works

1. Scan the buffer for the zstd frame magic number `28 B5 2F FD`.
2. Treat each magic offset as the start of a frame; the next magic offset (or
   end of file) is its end.
3. Run `zlib.zstdDecompressSync` on each slice.
4. Concatenate the decoded bytes.

A slice that fails to decode is skipped and counted in `failed`, so a false
positive on the magic number does not break the run.

## Where the session files live

```
<DSH profile>/sessions/--<workspace>--/<session-id>/session.v4.jsonl.zstd
```

On Windows, typically under `%USERPROFILE%\.dsh\sessions\`.

## License

MIT
