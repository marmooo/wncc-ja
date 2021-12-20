mkdir -p docs
cp -r src/* docs
minify -r src -o docs
cp node_modules/sql.js-httpvfs/dist/sqlite.worker.js docs/sql.js-httpvfs/
cp node_modules/sql.js-httpvfs/dist/sql-wasm.wasm docs/sql.js-httpvfs/
deno bundle src/index.js > docs/index.js
