import { createDbWorker } from "../node_modules/sql.js-httpvfs/dist/index.js";

function loadConfig() {
  if (localStorage.getItem("darkMode") == 1) {
    document.documentElement.setAttribute("data-bs-theme", "dark");
  }
}

function toggleDarkMode() {
  if (localStorage.getItem("darkMode") == 1) {
    localStorage.setItem("darkMode", 0);
    document.documentElement.setAttribute("data-bs-theme", "light");
  } else {
    localStorage.setItem("darkMode", 1);
    document.documentElement.setAttribute("data-bs-theme", "dark");
  }
}

function search() {
  const word = document.getElementById("searchText").value;
  searchCollocations(word);
}

async function copyToClipboard(text) {
  await navigator.clipboard.writeText(text);
  alert("クリップボードにコピーしました。");
}

async function searchCollocations(lemma) {
  if (!dbWorker) return;
  const loading = document.getElementById("loading");
  loading.classList.remove("d-none");
  const obj = document.getElementById("collocations");
  const row = await dbWorker.searchLemma.getAsObject([lemma]);
  while (obj.firstChild) {
    obj.removeChild(obj.firstChild);
  }
  if (row.words) {
    const words = JSON.parse(row.words);
    for (const word of words) {
      const button = document.createElement("button");
      button.className = "btn btn-outline-secondary m-1";
      button.textContent = word;
      button.type = "button";
      button.onclick = () => {
        copyToClipboard(button.textContent);
      };
      obj.appendChild(button);
    }
  }
  loading.classList.add("d-none");
}

async function loadDBWorker() {
  const config = {
    from: "jsonconfig",
    configUrl: "/wncc-ja/db/config.json",
  };
  const loading = document.getElementById("loading");
  loading.classList.remove("d-none");
  dbWorker = await createDbWorker(
    [config],
    "/wncc-ja/sql.js-httpvfs/sqlite.worker.js",
    "/wncc-ja/sql.js-httpvfs/sql-wasm.wasm",
  );
  dbWorker.searchLemma = await dbWorker.db.prepare(
    `SELECT words FROM collocations WHERE lemma=?`,
  );
  loading.classList.add("d-none");
}

let dbWorker;
loadConfig();
loadDBWorker();

document.addEventListener("keydown", (event) => {
  if (event.key == "Enter") search();
});
document.getElementById("toggleDarkMode").onclick = toggleDarkMode;
document.getElementById("search").onclick = search;
