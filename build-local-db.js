import { readLines } from "https://deno.land/std/io/mod.ts";
import { Database } from "./deps.ts";
import $ from "https://deno.land/x/dax/mod.ts";

const batchSize = 1000;
const pppAdjective = ["が"];
const pppLinker = ["は", "も", "こそ", "でも", "しか", "さえ"]; // 係助詞
const ppp3a = ["など", "なり", "やら", "か"]; // 副助詞
const ppp3b = ["の", "に", "と", "や", "し", "やら", "か", "なり", "だの"]; // 並列助詞
const ppp3Adjective = pppLinker.concat(pppAdjective);
const ppp3Noun = ppp3a.concat(ppp3b);
const ppp4a = ["ばかり", "まで", "だけ", "ほど", "くらい"]; // 副助詞
const ppp4b = ["を", "へ", "と", "から", "より", "で"]; // 格助詞
const ppp4Verb = pppLinker.concat(ppp4a).concat(ppp4b);
// const ppp5Verb = ["が", "に"];

const db = new Database("local.db");
db.run("pragma synchronouse=OFF");
db.run("pragma journal_mode=MEMORY");
db.run(`
  CREATE TABLE IF NOT EXISTS words (
    wordid INTEGER PRIMARY KEY AUTOINCREMENT,
    lemma TEXT,
    count INTEGER
  )
`);
db.run(`
  CREATE TABLE IF NOT EXISTS collocations (
    wordid INTEGER,
    word TEXT,
    count INTEGER
  )
`);
const getWordId = db.prepare(`
  SELECT wordid FROM words WHERE lemma = ? LIMIT 1
`);
const insertLemma = db.prepare(`
  INSERT INTO words (lemma, count) VALUES(?, ?);
`);
const insertCollocation = db.prepare(`
  INSERT INTO collocations (wordid, word, count) VALUES(?, ?, ?);
`);

// https://github.com/sera1mu/deno_mecab
// deno_mecab style Mecab + IPADic parser, but 30x faster
async function parseMecab(filepath) {
  const result = [];
  const stdout = await $`mecab ${filepath}`.text();
  stdout.slice(0, -4).split("\nEOS\n").forEach((sentence) => {
    const morphemes = [];
    sentence.replace(/\t/g, ",").split("\n").forEach((line) => {
      const cols = line.split(",");
      const morpheme = {
        surface: cols[0],
        feature: cols[1],
        featureDetails: [cols[2], cols[3], cols[4]],
        conjugationForms: [cols[5], cols[6]],
        originalForm: cols[7],
        reading: cols[8],
        pronunciation: cols[9],
      };
      morphemes.push(morpheme);
    });
    result.push(morphemes);
  });
  return result;
}

async function parseText(text) {
  const tmpfileName = await Deno.makeTempFile();
  await Deno.writeTextFile(tmpfileName, text);
  const result = await parseMecab(tmpfileName);
  Deno.remove(tmpfileName);
  return result;
}

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
  const fileReader = await Deno.open(
    "nwc2010-ngrams/word/over999/1gms/1gm-0000",
  );
  const result = [];
  for await (const line of readLines(fileReader)) {
    if (!line) continue;
    const arr = line.split(/\s/);
    const lemma = arr[0];
    // 数字記号は無視
    if (!/^[ぁ-ゖァ-ヶー\u4E00-\u9FFF々 ]+$/.test(lemma)) continue;
    // 一文字のひらがなカタカナは無視
    if (/^[ぁ-ゖァ-ヶー]$/.test(lemma)) continue;
    const count = parseInt(arr[1]);
    result.push([lemma, count]);
  }
  fileReader.close();
  db.transaction((result) => {
    result.forEach((row) => {
      insertLemma.run(...row);
    });
  })(result);
}

async function getSentences(filepath) {
  const sentences = [];
  const counts = [];
  const fileReader = await Deno.open(filepath);
  for await (const line of readLines(fileReader)) {
    if (!line) continue;
    const pos = line.lastIndexOf("\t");
    const sentence = line.slice(0, pos);
    // 数字記号は無視
    if (!/^[ぁ-ゖァ-ヶー\u4E00-\u9FFF々 ]+$/.test(sentence)) continue;
    const count = parseInt(sentence.slice(pos + 1));
    sentences.push(sentence);
    counts.push(count);
  }
  fileReader.close();
  return [sentences, counts];
}

async function parseLeft2() {
  const filepath = "nwc2010-ngrams/word/over999/2gms/2gm-0000";
  const [sentences, counts] = await getSentences(filepath);

  const dict = {};
  for (let i = 0; i < sentences.length; i += batchSize) {
    const batchSentences = sentences.slice(i, i + batchSize);
    const batchCounts = counts.slice(i, i + batchSize);
    const parsed = await parseText(batchSentences.join("\n"));
    batchSentences.forEach((sentence, i) => {
      const words = sentence.split(" ");
      const count = batchCounts[i];
      const morphemes = parsed[i];
      if (morphemes.length == words.length) {
        parseAdverb2(morphemes, words, sentence, count, dict);
        parseLeftNoun2(morphemes, words, sentence, count, dict);
        parseLeftAdjective2(morphemes, words, sentence, count, dict);
        parseLeftVerb2(morphemes, words, sentence, count, dict);
        parseAdnominalAdjective2(morphemes, words, sentence, count, dict);
      } else {
        // console.log(sentence);
      }
    });
  }
  insertDB("parseLeft2", dict);
}

function parseAdverb2(morphemes, words, _sentence, count, dict) {
  // 「一人」などの接尾辞の関係が抽出されやすい
  if (
    morphemes[0].feature == "副詞" &&
    (morphemes[1].feature == "動詞" || morphemes[1].feature == "形容詞")
  ) {
    const newSentence = words[0] + " " + morphemes[1].originalForm;
    updateDict(dict, words[0], newSentence, count);
    updateDict(dict, morphemes[1].originalForm, newSentence, count);
  }
}

function parseLeftNoun2(morphemes, words, sentence, count, dict) {
  // 「一人」などの接尾辞の関係が抽出されやすい
  if (
    morphemes[0].feature == "名詞" &&
    morphemes[1].feature == "名詞" &&
    morphemes[1].featureDetails[0] != "数"
  ) {
    updateDict(dict, morphemes[0].originalForm, sentence, count);
    updateDict(dict, words[1], sentence, count);
  }
}

function parseLeftAdjective2(morphemes, words, sentence, count, dict) {
  if (
    morphemes[0].feature == "形容詞" &&
    morphemes[1].feature == "名詞" &&
    morphemes[1].featureDetails[0] != "数"
  ) {
    updateDict(dict, morphemes[0].originalForm, sentence, count);
    updateDict(dict, words[1], sentence, count);
  }
}

function parseLeftVerb2(morphemes, words, sentence, count, dict) {
  // 体現接続特殊にはノイズがあるため削除する
  // 結果として「走法」などの使える語句も多少消えるが、共起語ではないので問題ない
  // 残したいなら SudachiDict などで正確に判定したほうが良い
  if (
    morphemes[0].feature == "動詞" &&
    !morphemes[0].featureDetails[0].startsWith("接尾") &&
    !morphemes[0].conjugationForms[1].startsWith("体言接続特殊") &&
    morphemes[1].feature == "名詞" &&
    morphemes[1].featureDetails[0] != "数"
  ) {
    updateDict(dict, morphemes[0].originalForm, sentence, count);
    updateDict(dict, words[1], sentence, count);
  }
}

function parseAdnominalAdjective2(morphemes, words, sentence, count, dict) {
  if (
    morphemes[0].feature == "連体詞" &&
    morphemes[1].feature == "名詞" &&
    morphemes[1].featureDetails[0] != "数"
  ) {
    updateDict(dict, words[0], sentence, count);
    updateDict(dict, words[1], sentence, count);
  }
}

async function parseLeft3() {
  const filepath = "nwc2010-ngrams/word/over999/3gms/3gm-0000";
  const [sentences, counts] = await getSentences(filepath);

  const dict = {};
  for (let i = 0; i < sentences.length; i += batchSize) {
    const batchSentences = sentences.slice(i, i + batchSize);
    const batchCounts = counts.slice(i, i + batchSize);
    const parsed = await parseText(batchSentences.join("\n"));
    batchSentences.forEach((sentence, i) => {
      const words = sentence.split(" ");
      const count = batchCounts[i];
      const morphemes = parsed[i];
      if (morphemes.length == words.length) {
        parseLeftAdjective3(morphemes, words, sentence, count, dict);
        parseLeftVerb3(morphemes, words, sentence, count, dict);
      } else {
        // console.log(sentence);
      }
    });
  }
  insertDB("parseLeft3", dict);
}

function parseLeftAdjective3(morphemes, words, _sentence, count, dict) {
  if (
    morphemes[0].feature == "形容詞" &&
    morphemes[0].conjugationForms[0] == "連用タ接続" &&
    morphemes[1].surface == "た" &&
    morphemes[2].feature == "名詞" &&
    morphemes[2].featureDetails[0] != "数"
  ) {
    const newSentence = morphemes[0].originalForm + " " + morphemes[2].surface;
    updateDict(dict, morphemes[0].originalForm, newSentence, count);
    updateDict(dict, words[2], newSentence, count);
  }
}

function parseLeftVerb3(morphemes, words, sentence, count, dict) {
  // 走った猫 --> 走る猫
  if (
    morphemes[2].feature == "名詞" && morphemes[2].featureDetails[0] != "数"
  ) {
    if (
      morphemes[0].feature == "動詞" &&
      morphemes[0].conjugationForms[0] == "連用タ接続" &&
      morphemes[1].surface == "た"
    ) {
      const newSentence = morphemes[0].originalForm + " " +
        morphemes[2].surface;
      updateDict(dict, morphemes[0].originalForm, newSentence, count);
      updateDict(dict, words[2], newSentence, count);
      // 走り続ける猫 --> 走る猫
    } else if (
      morphemes[0].feature == "動詞" &&
      morphemes[0].featureDetails.includes("自立") &&
      morphemes[1].feature == "動詞" &&
      morphemes[1].featureDetails.includes("非自立")
    ) {
      const newSentence = morphemes[0].originalForm + " " +
        morphemes[2].surface;
      updateDict(dict, morphemes[0].originalForm, newSentence, count);
      updateDict(dict, words[2], newSentence, count);
      // 追及する猫 --> 追及する猫
    } else if (
      morphemes[0].feature == "名詞" &&
      morphemes[0].featureDetails.includes("サ変接続") &&
      morphemes[1].feature == "動詞" &&
      morphemes[1].conjugationForms[0] == "サ変・スル"
    ) {
      updateDict(dict, morphemes[0].originalForm, sentence, count);
      updateDict(dict, words[2], sentence, count);
    }
  }
}

async function parseLeft4() {
  const filepath = "nwc2010-ngrams/word/over999/4gms/4gm-0000";
  const [sentences, counts] = await getSentences(filepath);

  const dict = {};
  for (let i = 0; i < sentences.length; i += batchSize) {
    const batchSentences = sentences.slice(i, i + batchSize);
    const batchCounts = counts.slice(i, i + batchSize);
    const parsed = await parseText(batchSentences.join("\n"));
    batchSentences.forEach((sentence, i) => {
      const words = sentence.split(" ");
      const count = batchCounts[i];
      const morphemes = parsed[i];
      if (morphemes.length == words.length) {
        parseLeftVerb4(morphemes, words, sentence, count, dict);
      } else {
        // console.log(sentence);
      }
    });
  }
  insertDB("parseLeft4", dict);
}

function parseLeftVerb4(morphemes, words, _sentence, count, dict) {
  if (
    morphemes[3].feature == "名詞" && morphemes[3].featureDetails[0] != "数"
  ) {
    // 走り続けた猫 --> 走る猫
    if (
      morphemes[0].feature == "動詞" &&
      morphemes[0].featureDetails.includes("自立") &&
      morphemes[1].feature == "動詞" &&
      morphemes[1].featureDetails.includes("非自立") &&
      morphemes[2].surface == "た"
    ) {
      const newSentence = morphemes[0].originalForm + " " +
        morphemes[3].surface;
      updateDict(dict, morphemes[0].originalForm, newSentence, count);
      updateDict(dict, words[3], newSentence, count);
      // 追及した猫 --> 追及する猫
    } else if (
      morphemes[0].feature == "名詞" &&
      morphemes[0].featureDetails.includes("サ変接続") &&
      morphemes[1].feature == "動詞" &&
      morphemes[1].conjugationForms[0] == "サ変・スル" &&
      morphemes[2].surface == "た"
    ) {
      const newSentence = morphemes[0].surface + " " +
        morphemes[1].originalForm +
        " " + morphemes[3].surface;
      updateDict(dict, words[0], newSentence, count);
      updateDict(dict, words[3], newSentence, count);
    }
  }
}

async function parseRight3() {
  const filepath = "nwc2010-ngrams/word/over999/3gms/3gm-0000";
  const [sentences, counts] = await getSentences(filepath);

  const dict = {};
  for (let i = 0; i < sentences.length; i += batchSize) {
    const batchSentences = sentences.slice(i, i + batchSize);
    const batchCounts = counts.slice(i, i + batchSize);
    const parsed = await parseText(batchSentences.join("\n"));
    batchSentences.forEach((sentence, i) => {
      const words = sentence.split(" ");
      const count = batchCounts[i];
      const morphemes = parsed[i];
      if (morphemes.length == words.length) {
        parseRightNoun3(morphemes, words, sentence, count, dict);
        parseRightAdjective3(morphemes, words, sentence, count, dict);
        parseRightVerb3(morphemes, words, sentence, count, dict);
      } else {
        // console.log(sentence);
      }
    });
  }
  insertDB("parseRight3", dict);
}

function parseRightNoun3(morphemes, words, sentence, count, dict) {
  if (ppp3Noun.includes(words[1])) {
    if (
      morphemes[0].feature == "名詞" &&
      !morphemes[0].featureDetails[0].startsWith("接尾") &&
      morphemes[2].feature == "名詞"
    ) {
      updateDict(dict, words[0], sentence, count);
      updateDict(dict, words[2], sentence, count);
    }
  }
}

function parseRightAdjective3(morphemes, words, _sentence, count, dict) {
  if (ppp3Adjective.includes(words[1])) {
    if (
      morphemes[0].feature == "名詞" &&
      !morphemes[0].featureDetails[0].startsWith("接尾") &&
      morphemes[2].feature == "形容詞"
    ) {
      const newSentence = words.slice(0, -1).join(" ") + " " +
        morphemes[2].originalForm;
      updateDict(dict, words[0], newSentence, count);
      updateDict(dict, morphemes[2].originalForm, newSentence, count);
    }
  }
}

function parseRightVerb3(morphemes, words, sentence, count, dict) {
  if (ppp4Verb.includes(words[1])) {
    // 未然形だけは意味が変わる可能性があるので除外
    if (
      morphemes[0].feature == "名詞" &&
      !morphemes[0].featureDetails[0].startsWith("接尾") &&
      morphemes[2].feature == "動詞" &&
      morphemes[2].conjugationForms[1] != "未然形"
    ) {
      const newSentence = words.slice(0, -1).join(" ") + " " +
        morphemes[2].originalForm;
      updateDict(dict, words[0], newSentence, count);
      updateDict(dict, morphemes[2].originalForm, newSentence, count);
    } else if (
      morphemes[0].feature == "名詞" &&
      !morphemes[0].featureDetails[0].startsWith("接尾") &&
      morphemes[2].feature == "名詞" &&
      morphemes[2].featureDetails.includes("サ変接続")
    ) {
      updateDict(dict, words[0], sentence, count);
      updateDict(dict, words[2], sentence, count);
    }
  }
}

async function parseRight4() {
  const filepath = "nwc2010-ngrams/word/over999/4gms/4gm-0000";
  const [sentences, counts] = await getSentences(filepath);

  const dict = {};
  for (let i = 0; i < sentences.length; i += batchSize) {
    const batchSentences = sentences.slice(i, i + batchSize);
    const batchCounts = counts.slice(i, i + batchSize);
    const parsed = await parseText(batchSentences.join("\n"));
    batchSentences.forEach((sentence, i) => {
      const words = sentence.split(" ");
      const count = batchCounts[i];
      const morphemes = parsed[i];
      if (morphemes.length == words.length) {
        parseRightVerb4(morphemes, words, sentence, count, dict);
      } else {
        // console.log(sentence);
      }
    });
  }
  insertDB("parseRight4", dict);
}

function parseRightVerb4(morphemes, words, _sentence, count, dict) {
  if (ppp4Verb.includes(words[1])) {
    // 未然形だけは意味が変わる可能性があるので除外
    // ネコが疾走する
    if (
      morphemes[0].feature == "名詞" &&
      !morphemes[0].featureDetails[0].startsWith("接尾") &&
      morphemes[2].feature == "名詞" &&
      morphemes[2].featureDetails.includes("サ変接続") &&
      morphemes[3].feature == "動詞" &&
      morphemes[3].conjugationForms[0] == "サ変・スル" &&
      morphemes[3].conjugationForms[1] != "未然形"
    ) {
      const newSentence = words.slice(0, -1).join(" ") + " " +
        morphemes[3].originalForm;
      updateDict(dict, words[0], newSentence, count);
      updateDict(dict, words[2], newSentence, count);
      // 未然形だけは意味が変わる可能性があるので除外
      // 視線を走らせる
    } else if (
      morphemes[0].feature == "名詞" &&
      !morphemes[0].featureDetails[0].startsWith("接尾") &&
      morphemes[2].feature == "動詞" &&
      morphemes[3].feature == "動詞" &&
      morphemes[3].conjugationForms[1] != "未然形"
    ) {
      const newSentence = words.slice(0, -1).join(" ") + " " +
        morphemes[3].originalForm;
      updateDict(dict, words[0], newSentence, count);
      updateDict(dict, words[2], newSentence, count);
    }
  }
}

function insertDB(name, dict) {
  db.transaction((data) => {
    for (const [word, collocations] of Object.entries(data)) {
      for (const [collocation, count] of collocations) {
        const row = getWordId.value(word);
        if (row) {
          const wordId = row[0];
          insertCollocation.run(wordId, collocation, count);
        } else {
          console.log("error: " + word);
        }
      }
    }
  })(dict);
  console.log(name);
}

await parseLemma();
db.run(`
  CREATE INDEX IF NOT EXISTS words_index ON words(lemma)
`);
await parseLeft2();
await parseLeft3();
await parseLeft4();
await parseRight3();
await parseRight4();
db.run(`
  CREATE INDEX IF NOT EXISTS collocations_index ON collocations(wordid)
`);
