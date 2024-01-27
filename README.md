# wncc-ja

Web N-gram based Collocation Corpus (Japanese)

[日本語の共起コーパス](https://marmooo.github.io/wncc-ja/)です。例文辞書としても使えます。

## Requirements

```
sudo apt install mecab mecab-ipadic-utf8
```

## Installation

- install [N-gram corpus](http://www.s-yata.jp/corpus/nwc2010/ngrams/) (free)
- `npm install`

## Build

```
deno run -A --unstable-ffi build-local-db.js
deno run -A --unstable-ffi build-remote-db.js
bash optimize.sh
bash build.sh
bash create_db.sh remote.db docs/db
```

## Related projects

- [wncc-en](https://github.com/marmooo/wncc-en) (English)

## License

CC BY 4.0
