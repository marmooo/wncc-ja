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
  const obj = document.getElementById("collocations");
  const row1 = await dbWorker.db.query(
    `SELECT wordid FROM words WHERE lemma="${escapeSql(lemma)}"`,
  );
  if (row1[0]) {
    const wordid = row1[0].wordid;
    const row2 = await dbWorker.db.query(
      `SELECT word FROM collocations WHERE wordid=${wordid} ORDER BY count DESC`,
    );
    while (obj.firstChild) {
      obj.removeChild(obj.firstChild);
    }
    for (const item of row2) {
      const word = item.word;
      const button = document.createElement("button");
      button.className = "btn btn-outline-secondary m-1";
      button.textContent = word;
      button.onclick = function () {
        copyToClipboard(button.textContent);
      };
      obj.appendChild(button);
    }
  } else {
    while (obj.firstChild) {
      obj.removeChild(obj.firstChild);
    }
  }
}

async function loadDBWorker() {
  const config = {
    from: "jsonconfig",
    configUrl: "/db/config.json",
  };
  dbWorker = await createDbWorker(
    [config],
    "/sql.js-httpvfs/sqlite.worker.js",
    "/sql.js-httpvfs/sql-wasm.wasm",
  );
  searchCollocations("走る");
}

let dbWorker;
loadConfig();
loadDBWorker();

document.addEventListener("keydown", function (event) {
  if (event.key == "Enter") {
    search();
  }
}, false);
document.getElementById("toggleDarkMode").onclick = toggleDarkMode;
document.getElementById("search").onclick = search;
