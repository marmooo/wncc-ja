import { escapeSql } from "https://deno.land/x/escape/mod.ts";
import { createDbWorker } from "../node_modules/sql.js-httpvfs/dist/index.js";

function loadConfig() {
  if (localStorage.getItem("darkMode") == 1) {
    document.documentElement.dataset.theme = "dark";
  }
}

function toggleDarkMode() {
  if (localStorage.getItem("darkMode") == 1) {
    localStorage.setItem("darkMode", 0);
    delete document.documentElement.dataset.theme;
  } else {
    localStorage.setItem("darkMode", 1);
    document.documentElement.dataset.theme = "dark";
  }
}

function search() {
  const word = document.getElementById("searchText").value;
  searchCollocations(word);
}

function iosCopyToClipboard(el) {
  // resolve the element
  el = (typeof el === "string") ? document.querySelector(el) : el;

  // handle iOS as a special case
  if (navigator.userAgent.match(/ipad|ipod|iphone/i)) {
    // save current contentEditable/readOnly status
    const editable = el.contentEditable;
    const readOnly = el.readOnly;

    // convert to editable with readonly to stop iOS keyboard opening
    el.contentEditable = true;
    el.readOnly = true;

    // create a selectable range
    const range = document.createRange();
    range.selectNodeContents(el);

    // select the range
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    el.setSelectionRange(0, 999999);

    // restore contentEditable/readOnly to original state
    el.contentEditable = editable;
    el.readOnly = readOnly;
  } else {
    el.select();
  }

  // execute copy command
  document.execCommand("copy");
}

function copyToClipboard(text) {
  const input = document.createElement("textarea");
  document.body.appendChild(input);
  input.value = text;
  iosCopyToClipboard(input);
  document.body.removeChild(input);
  alert("クリップボードにコピーしました。");
}

async function searchCollocations(lemma) {
  const loading = document.getElementById("loading");
  loading.classList.remove("d-none");
  const obj = document.getElementById("collocations");
  const row = await dbWorker.db.query(
    `SELECT words FROM collocations WHERE lemma="${escapeSql(lemma)}"`,
  );
  while (obj.firstChild) {
    obj.removeChild(obj.firstChild);
  }
  if (row[0]) {
    const words = JSON.parse(row[0].words);
    for (const word of words) {
      const button = document.createElement("button");
      button.className = "btn btn-outline-secondary m-1";
      button.textContent = word;
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
  dbWorker = await createDbWorker(
    [config],
    "/wncc-ja/sql.js-httpvfs/sqlite.worker.js",
    "/wncc-ja/sql.js-httpvfs/sql-wasm.wasm",
  );
}

let dbWorker;
loadConfig();
loadDBWorker();

document.addEventListener("keydown", function (event) {
  if (event.key == "Enter") search();
}, false);
document.getElementById("toggleDarkMode").onclick = toggleDarkMode;
document.getElementById("search").onclick = search;
