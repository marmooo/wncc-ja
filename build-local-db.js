import { readLines } from "https://deno.land/std/io/mod.ts";
import { MeCab } from "https://deno.land/x/deno_mecab/mod.ts";
import { DB } from "https://deno.land/x/sqlite/mod.ts";

const pppAdjective = ["が"];
const pppLinker = ["は", "も", "こそ", "でも", "しか", "さえ"]; // 係助詞
const ppp3a = ["など", "なり", "やら", "か"]; // 副助詞
const ppp3b = ["の", "に", "と", "や", "し", "やら", "か", "なり", "だの"]; // 並列助詞
const ppp3Adjective = pppLinker.concat(pppAdjective);
const ppp3Noun = ppp3a.concat(ppp3b);
const ppp4a = ["ばかり", "まで", "だけ", "ほど", "くらい"]; // 副助詞
const ppp4b = ["を", "へ", "と", "から", "より", "で"]; // 格助詞
const ppp4Verb = pppLinker.concat(ppp4a).concat(ppp4b);
const ppp5Verb = ["が", "に"];

const db = new DB("local.db");
db.query(`
  CREATE TABLE IF NOT EXISTS words (
    wordid INTEGER PRIMARY KEY AUTOINCREMENT,
    lemma TEXT,
    count INTEGER
  )
`);
db.query(`
  CREATE TABLE IF NOT EXISTS collocations (
    wordid INTEGER,
    word TEXT,
    count INTEGER
  )
`);
const getWordId = db.prepareQuery(`
  SELECT wordid FROM words WHERE lemma = ?
`);
const insertLemma = db.prepareQuery(`
  INSERT INTO words (lemma, count) VALUES(?, ?);
`);
const insertCollocation = db.prepareQuery(`
  INSERT INTO collocations (wordid, word, count) VALUES(?, ?, ?);
`);

function updateDict(dict, lemma, sentence, count) {
  if (lemma in dict) {
    const collocations = dict[lemma];
    const pos = collocations.findIndex((c) => c[0] == sentence);
    if (pos >= 0) {
      collocations[pos][1] += count;
      dict[lemma] = collocations;
    } else {
      dict[lemma].push([sentence, count]);
    }
  } else {
    dict[lemma] = [[sentence, count]];
  }
}

async function parseLemma() {
  db.query("begin");
  const fileReader = await Deno.open(
    "nwc2010-ngrams/word/over999/1gms/1gm-0000",
  );
  for await (const line of readLines(fileReader)) {
    if (!line) continue;
    const arr = line.split(/\s/);
    const lemma = arr[0];
    // 数字記号は無視
    if (!/^[ぁ-んァ-ヴ\u4E00-\u9FFF ]+$/.test(lemma)) continue;
    // 一文字のひらがなカタカナは無視
    if (/^[ぁ-んァ-ヴ]$/.test(lemma)) continue;
    const count = parseInt(arr[1]);
    insertLemma.execute([lemma, count]);
  }
  db.query("commit");
}

async function parseLeft2() {
  const dict = {};
  const fileReader = await Deno.open(
    "nwc2010-ngrams/word/over999/2gms/2gm-0000",
  );
  for await (const line of readLines(fileReader)) {
    if (!line) continue;
    const arr = line.split(/\s/);
    const words = arr.slice(0, -1);
    // まったく一緒の解析結果にはならないが、空白を入れるとエラー率は下がる
    const sentence = words.join(" ");
    // 数字記号は無視
    if (!/^[ぁ-んァ-ヴ\u4E00-\u9FFF ]+$/.test(sentence)) continue;
    // 一文字のひらがなカタカナは無視
    if (/^[ぁ-んァ-ヴ]$/.test(words.slice(-1))) continue;
    const count = parseInt(arr.slice(-1));
    const parsed = await mecab.parse(sentence);
    if (parsed.length == words.length) {
      parseAdverb(parsed, words, sentence, count, dict);
      parseLeftNoun2(parsed, words, sentence, count, dict);
      parseLeftAdjective2(parsed, words, sentence, count, dict);
      parseLeftVerb2(parsed, words, sentence, count, dict);
      parseAdnominalAdjective2(parsed, words, sentence, count, dict);
    } else {
      // console.log(sentence);
    }
  }
  insertDB("parseLeft2", dict);
}

function parseAdverb(parsed, words, sentence, count, dict) {
  // 「一人」などの接尾辞の関係が抽出されやすい
  if (parsed[0].feature == "副詞" &&
    (parsed[1].feature == "動詞" || parsed[1].feature == "形容詞")) {
    const newSentence = words[0] + " " + parsed[1].originalForm;
    updateDict(dict, words[0], newSentence, count);
    updateDict(dict, parsed[1].originalForm, newSentence, count);
  }
}

function parseLeftNoun2(parsed, words, sentence, count, dict) {
  // 「一人」などの接尾辞の関係が抽出されやすい
  if (parsed[0].feature == "名詞" &&
    parsed[1].feature == "名詞" &&
    parsed[1].featureDetails[0] != "数") {
    updateDict(dict, parsed[0].originalForm, sentence, count);
    updateDict(dict, words[1], sentence, count);
  }
}

function parseLeftAdjective2(parsed, words, sentence, count, dict) {
  if (parsed[0].feature == "形容詞" &&
    parsed[1].feature == "名詞" &&
    parsed[1].featureDetails[0] != "数") {
    updateDict(dict, parsed[0].originalForm, sentence, count);
    updateDict(dict, words[1], sentence, count);
  }
}

function parseLeftVerb2(parsed, words, sentence, count, dict) {
  // 体現接続特殊にはノイズがあるため削除する
  // 結果として「走法」などの使える語句も多少消えるが、共起語ではないので問題ない
  // 残したいなら SudachiDict などで正確に判定したほうが良い
  if (parsed[0].feature == "動詞" &&
    !parsed[0].conjugationForms[1].startsWith("体言接続特殊") &&
    parsed[1].feature == "名詞" &&
    parsed[1].featureDetails[0] != "数") {
    updateDict(dict, parsed[0].originalForm, sentence, count);
    updateDict(dict, words[1], sentence, count);
  }
}

function parseAdnominalAdjective2(parsed, words, sentence, count, dict) {
  if (parsed[0].feature == "連体詞" &&
    parsed[1].feature == "名詞" &&
    parsed[1].featureDetails[0] != "数") {
    updateDict(dict, words[0], sentence, count);
    updateDict(dict, words[1], sentence, count);
  }
}

async function parseLeft3() {
  const dict = {};
  const fileReader = await Deno.open(
    "nwc2010-ngrams/word/over999/3gms/3gm-0000",
  );
  for await (const line of readLines(fileReader)) {
    if (!line) continue;
    const arr = line.split(/\s/);
    const words = arr.slice(0, -1);
    // まったく一緒の解析結果にはならないが、空白を入れるとエラー率は下がる
    const sentence = words.join(" ");
    // 数字記号は無視
    if (!/^[ぁ-んァ-ヴ\u4E00-\u9FFF ]+$/.test(sentence)) continue;
    // 一文字のひらがなカタカナは無視
    if (/^[ぁ-んァ-ヴ]$/.test(words.slice(-1))) continue;
    const count = parseInt(arr.slice(-1));
    const parsed = await mecab.parse(sentence);
    if (parsed.length == words.length) {
      parseLeftAdjective3(parsed, words, sentence, count, dict);
      parseLeftVerb3(parsed, words, sentence, count, dict);
    } else {
      // console.log(sentence);
    }
  }
  insertDB("parseLeft3", dict);
}

function parseLeftAdjective3(parsed, words, sentence, count, dict) {
  if (
    parsed[0].feature == "形容詞" &&
    parsed[0].conjugationForms[0] == "連用タ接続" &&
    parsed[1].surface == "た" &&
    parsed[2].feature == "名詞" &&
    parsed[2].featureDetails[0] != "数") {
    const newSentence = parsed[0].originalForm + " " + parsed[2].surface;
    updateDict(dict, parsed[0].originalForm, newSentence, count);
    updateDict(dict, words[2], newSentence, count);
  }
}

function parseLeftVerb3(parsed, words, sentence, count, dict) {
  // 走った猫 --> 走る猫
  if (parsed[2].feature == "名詞" && parsed[2].featureDetails[0] != "数") {
    if (
      parsed[0].feature == "動詞" &&
      parsed[0].conjugationForms[0] == "連用タ接続" &&
      parsed[1].surface == "た"
    ) {
      const newSentence = parsed[0].originalForm + " " + parsed[2].surface;
      updateDict(dict, parsed[0].originalForm, newSentence, count);
      updateDict(dict, words[2], newSentence, count);
      // 走り続ける猫 --> 走る猫
    } else if (
      parsed[0].feature == "動詞" &&
      parsed[0].featureDetails.includes("自立") &&
      parsed[1].feature == "動詞" && parsed[1].featureDetails.includes("非自立")
    ) {
      const newSentence = parsed[0].originalForm + " " + parsed[2].surface;
      updateDict(dict, parsed[0].originalForm, newSentence, count);
      updateDict(dict, words[2], newSentence, count);
      // 追及する猫 --> 追及する猫
    } else if (
      parsed[0].feature == "名詞" &&
      parsed[0].featureDetails.includes("サ変接続") &&
      parsed[1].feature == "動詞" &&
      parsed[1].conjugationForms[0] == "サ変・スル"
    ) {
      updateDict(dict, parsed[0].originalForm, sentence, count);
      updateDict(dict, words[2], sentence, count);
    }
  }
}

async function parseLeft4() {
  const dict = {};
  const fileReader = await Deno.open(
    "nwc2010-ngrams/word/over999/4gms/4gm-0000",
  );
  for await (const line of readLines(fileReader)) {
    if (!line) continue;
    const arr = line.split(/\s/);
    const words = arr.slice(0, -1);
    // まったく一緒の解析結果にはならないが、空白を入れるとエラー率は下がる
    const sentence = words.join(" ");
    // 数字記号は無視
    if (!/^[ぁ-んァ-ヴ\u4E00-\u9FFF ]+$/.test(sentence)) continue;
    // 一文字のひらがなカタカナは無視
    if (/^[ぁ-んァ-ヴ]$/.test(words.slice(-1))) continue;
    const count = parseInt(arr.slice(-1));
    const parsed = await mecab.parse(sentence);
    if (parsed.length == words.length) {
      parseLeftVerb4(parsed, words, sentence, count, dict);
    } else {
      // console.log(sentence);
    }
  }
  insertDB("parseLeft4", dict);
}

function parseLeftVerb4(parsed, words, sentence, count, dict) {
  if (parsed[3].feature == "名詞" && parsed[3].featureDetails[0] != "数") {
    // 走り続けた猫 --> 走る猫
    if (
      parsed[0].feature == "動詞" &&
      parsed[0].featureDetails.includes("自立") &&
      parsed[1].feature == "動詞" &&
      parsed[1].featureDetails.includes("非自立") &&
      parsed[2].surface == "た"
    ) {
      const newSentence = parsed[0].originalForm + " " + parsed[3].surface;
      updateDict(dict, parsed[0].originalForm, newSentence, count);
      updateDict(dict, words[3], newSentence, count);
      // 追及した猫 --> 追及する猫
    } else if (
      parsed[0].feature == "名詞" &&
      parsed[0].featureDetails.includes("サ変接続") &&
      parsed[1].feature == "動詞" &&
      parsed[1].conjugationForms[0] == "サ変・スル" &&
      parsed[2].surface == "た"
    ) {
      const newSentence = parsed[0].surface + " " + parsed[1].originalForm +
        " " + parsed[3].surface;
      updateDict(dict, words[0], sentence, count);
      updateDict(dict, words[3], sentence, count);
    }
  }
}

async function parseRight3() {
  const dict = {};
  const fileReader = await Deno.open(
    "nwc2010-ngrams/word/over999/3gms/3gm-0000",
  );
  for await (const line of readLines(fileReader)) {
    if (!line) continue;
    const arr = line.split(/\s/);
    const words = arr.slice(0, -1);
    // まったく一緒の解析結果にはならないが、空白を入れるとエラー率は下がる
    const sentence = words.join(" ");
    // 数字記号は無視
    if (!/^[ぁ-んァ-ヴ\u4E00-\u9FFF ]+$/.test(sentence)) continue;
    // 一文字のひらがなカタカナは無視
    if (/^[ぁ-んァ-ヴ]$/.test(words[0])) continue;
    if (!/^[ぁ-んァ-ヴ]$/.test(words[1])) continue;  // 助詞の簡易チェック
    const count = parseInt(arr.slice(-1));
    const parsed = await mecab.parse(sentence);
    if (parsed.length == words.length) {
      parseRightNoun3(parsed, words, sentence, count, dict);
      parseRightAdjective3(parsed, words, sentence, count, dict);
      parseRightVerb3(parsed, words, sentence, count, dict);
    }
  }
  insertDB("parseRight3", dict);
}

function parseRightNoun3(parsed, words, sentence, count, dict) {
  if (ppp3Noun.includes(words[1])) {
    if (parsed[0].feature == "名詞" && parsed[2].feature == "名詞") {
      updateDict(dict, words[0], sentence, count);
      updateDict(dict, words[2], sentence, count);
    }
  }
}

function parseRightAdjective3(parsed, words, sentence, count, dict) {
  if (ppp3Adjective.includes(words[1])) {
    if (parsed[0].feature == "名詞" && parsed[2].feature == "形容詞") {
      const newSentence = words.slice(0, -1).join(" ") + " " +
        parsed[2].originalForm;
      updateDict(dict, words[0], newSentence, count);
      updateDict(dict, parsed[2].originalForm, newSentence, count);
    }
  }
}

function parseRightVerb3(parsed, words, sentence, count, dict) {
  if (ppp4Verb.includes(words[1])) {
    // 未然形だけは意味が変わる可能性があるので除外
    if (parsed[0].feature == "名詞" && parsed[2].feature == "動詞" &&
      parsed[2].conjugationForms[1] != "未然形") {
      const newSentence = words.slice(0, -1).join(" ") + " " +
        parsed[2].originalForm;
      updateDict(dict, words[0], newSentence, count);
      updateDict(dict, parsed[2].originalForm, newSentence, count);
    } else if (
      parsed[0].feature == "名詞" &&
      parsed[2].feature == "名詞" && parsed[2].featureDetails.includes("サ変接続")
    ) {
      updateDict(dict, words[0], sentence, count);
      updateDict(dict, words[2], sentence, count);
    }
  }
}

async function parseRight4() {
  const dict = {};
  const fileReader = await Deno.open(
    "nwc2010-ngrams/word/over999/4gms/4gm-0000",
  );
  for await (const line of readLines(fileReader)) {
    if (!line) continue;
    const arr = line.split(/\s/);
    const words = arr.slice(0, -1);
    // まったく一緒の解析結果にはならないが、空白を入れるとエラー率は下がる
    const sentence = words.join(" ");
    // 数字記号は無視
    if (!/^[ぁ-んァ-ヴ\u4E00-\u9FFF ]+$/.test(sentence)) continue;
    // 一文字のひらがなカタカナは無視
    if (/^[ぁ-んァ-ヴ]$/.test(words[0])) continue;
    if (!/^[ぁ-んァ-ヴ]$/.test(words[1])) continue;  // 助詞の簡易チェック
    const count = parseInt(arr.slice(-1));
    const parsed = await mecab.parse(sentence);
    if (parsed.length == words.length) {
      parseRightVerb4(parsed, words, sentence, count, dict);
    }
  }
  insertDB("parseRight4", dict);
}

function parseRightVerb4(parsed, words, sentence, count, dict) {
  if (ppp4Verb.includes(words[1])) {
    // 未然形だけは意味が変わる可能性があるので除外
    // ネコが疾走する
    if (
      parsed[0].feature == "名詞" &&
      parsed[2].feature == "名詞" &&
      parsed[2].featureDetails.includes("サ変接続") &&
      parsed[3].feature == "動詞" &&
      parsed[3].conjugationForms[0] == "サ変・スル" &&
      parsed[3].conjugationForms[1] != "未然形"
    ) {
      const newSentence = words.slice(0, -1).join(" ") + " " +
        parsed[3].originalForm;
      updateDict(dict, words[0], newSentence, count);
      updateDict(dict, words[2], newSentence, count);
    // 未然形だけは意味が変わる可能性があるので除外
    // 視線を走らせる
    } else if (
      parsed[0].feature == "名詞" &&
      parsed[2].feature == "動詞" &&
      parsed[3].feature == "動詞" &&
      parsed[3].conjugationForms[1] != "未然形"
    ) {
      const newSentence = words.slice(0, -1).join(" ") + " " +
        parsed[3].originalForm;
      updateDict(dict, words[0], newSentence, count);
      updateDict(dict, words[2], newSentence, count);
    }
  }
}

function insertDB(name, dict) {
  db.query("begin");
  for (const [word, collocations] of Object.entries(dict)) {
    for (const [collocation, count] of collocations) {
      const [wordIds] = getWordId.all([word]);
      if (wordIds) {
        const wordId = wordIds[0];
        if (wordId) {
          insertCollocation.execute([wordId, collocation, count]);
        } else {
          console.log("error: " + word);
        }
      }
    }
  }
  db.query("commit");
  console.log(name);
}

const mecab = new MeCab(["mecab"]);
await parseLemma();
db.query(`
  CREATE INDEX IF NOT EXISTS words_index ON words(lemma)
`);
await parseLeft2();
await parseLeft3();
await parseLeft4();
await parseRight3();
await parseRight4();
db.query(`
  CREATE INDEX IF NOT EXISTS collocations_index ON collocations(wordid)
`);
