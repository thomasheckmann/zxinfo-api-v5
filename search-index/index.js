/**
 * zxinfo-search index for autocomplete - used by quick-search at SC
 *
 * To update zxinfo-api-v5 in production
 *
 * > cd search-index/mappings
 * > ES_HOST=http://internal.zxinfo.dk/e ./create_index.sh
 * > cd ..
 * > nvm use v20.16.0
 * > ES_HOST=http://internal.zxinfo.dk ES_PATH="/e" ZXDB=zxdb-1.0.211 node index.js
 * local> ES_HOST=http://localhost:9400 ES_PATH="" ZXDB=zxdb-1.0.220 node index.js
 */

"use strict";

const softwareSQL = `
  SELECT 
    z.full_title, 
    z.entry_seo, 
    (WITH t1 AS (select title, entry_id from aliases UNION select alias, entry_id as title from contents ) select GROUP_CONCAT(DISTINCT title ORDER by title SEPARATOR ';;' ) as alias from t1 where t1.entry_id = e.id) as aliases,
    g.text as genretype_text, 
    e.id, 
    q.date_year, 
    q.date_month, 
    q.date_day, 
    r.release_year, 
    r.release_month, 
    r.release_day, 
    e.availabletype_id, 
    m.text as machine_type_text, 
    coalesce(z.orig_pubs, z.orig_comps) as pub_names,
    e.is_xrated as xrated 
  FROM 
    entries e 
    INNER JOIN sc_entries z ON e.id = z.id 
    INNER JOIN releases r on e.id = r.entry_id 
    AND r.release_seq = 0 
    INNER JOIN search_by_origins q on e.id = q.entry_id 
    LEFT JOIN genretypes g on e.genretype_id = g.id 
    LEFT JOIN machinetypes m on e.machinetype_id = m.id 
    LEFT JOIN availabletypes y on e.availabletype_id = y.id 
  WHERE
    (
      e.availabletype_id IS NULL 
      OR e.availabletype_id <> '*'
    ) 
    AND e.id IN (
      select 
        entry_id 
      from 
        search_by_titles 
    ) 
    AND (
      e.genretype_id is null 
      or e.genretype_id in (
        SELECT 
          id 
        FROM 
          genretypes 
        WHERE 
          text not like 'Book%' 
          and text not like 'Hardware%'
      )
    ) 
    AND (
      z.is_crap = 0 
      or e.id in (
        select 
          entry_id 
        from 
          members 
        where 
          tag_id = 1000
      )
    ) 
    AND e.id NOT IN (
      14579, 15100, 15101, 15102, 15103, 32305, 
      7376, 7716, 32241
    )
  GROUP BY 
    e.id 
  ORDER BY 
    IF(z.full_title like '[%', 1, 0), 
    q.library_title, 
    r.release_year, 
    e.id `;

const hardwareSQL = `
SELECT 
  z.full_title, 
  z.entry_seo, 
  (select GROUP_CONCAT(DISTINCT title ORDER by title SEPARATOR ';;' ) as alias from aliases where entry_id = e.id) as aliases,
  g.text as genretype_text, 
  e.id, 
  q.date_year, 
  q.date_month, 
  q.date_day, 
  r.release_year, 
  r.release_month, 
  r.release_day, 
  e.availabletype_id, 
  m.text as machine_type_text, 
  coalesce(z.orig_pubs, z.orig_comps) as pub_names,
  e.is_xrated as xrated
FROM 
  entries e 
  INNER JOIN sc_entries z ON e.id = z.id 
  INNER JOIN releases r on e.id = r.entry_id 
  AND r.release_seq = 0 
  INNER JOIN search_by_origins q on e.id = q.entry_id 
  LEFT JOIN genretypes g on e.genretype_id = g.id 
  LEFT JOIN machinetypes m on e.machinetype_id = m.id 
  LEFT JOIN availabletypes y on e.availabletype_id = y.id 
WHERE 
  (
    e.availabletype_id IS NULL 
    OR e.availabletype_id <> '*'
  ) 
  AND e.id IN (
    select 
      entry_id 
    from 
      search_by_titles 
  ) 
  AND e.genretype_id in (
    SELECT 
      id 
    FROM 
      genretypes 
    WHERE 
      text like 'Hardware%'
  ) 
  AND (
    z.is_crap = 0 
    or e.id in (
      select 
        entry_id 
      from 
        members 
      where 
        tag_id = 1000
    )
  ) 
  AND e.is_xrated = 0 
  AND e.id NOT IN (
    14579, 15100, 15101, 15102, 15103, 32305, 
    7376, 7716, 32241
  ) 
GROUP BY 
  e.id 
ORDER BY 
  IF(z.full_title like '[%', 1, 0), 
  q.library_title, 
  r.release_year, 
  e.id`;

const booksSQL = `
SELECT 
  z.full_title, 
  z.entry_seo, 
  (select GROUP_CONCAT(DISTINCT title ORDER by title SEPARATOR ';;' ) as alias from aliases where entry_id = e.id) as aliases,
  g.text as genretype_text, 
  e.id, 
  q.date_year, 
  q.date_month, 
  q.date_day, 
  r.release_year, 
  r.release_month, 
  r.release_day, 
  e.availabletype_id, 
  m.text as machine_type_text, 
  coalesce(z.orig_pubs, z.orig_comps) as pub_names,
  e.is_xrated as xrated
FROM 
  entries e 
  INNER JOIN sc_entries z ON e.id = z.id 
  INNER JOIN releases r on e.id = r.entry_id 
  AND r.release_seq = 0 
  INNER JOIN search_by_origins q on e.id = q.entry_id 
  LEFT JOIN genretypes g on e.genretype_id = g.id 
  LEFT JOIN machinetypes m on e.machinetype_id = m.id 
  LEFT JOIN availabletypes y on e.availabletype_id = y.id 
WHERE 
  (
    e.availabletype_id IS NULL 
    OR e.availabletype_id <> '*'
  ) 
  AND e.id IN (
    select 
      entry_id 
    from 
      search_by_titles 
  ) 
  AND e.genretype_id in (
    SELECT 
      id 
    FROM 
      genretypes 
    WHERE 
      text like 'Book%'
  ) 
  AND (
    z.is_crap = 0 
    or e.id in (
      select 
        entry_id 
      from 
        members 
      where 
        tag_id = 1000
    )
  ) 
  AND e.is_xrated = 0 
  AND e.id NOT IN (
    14579, 15100, 15101, 15102, 15103, 32305, 
    7376, 7716, 32241
  ) 
GROUP BY 
  e.id 
ORDER BY 
  IF(z.full_title like '[%', 1, 0), 
  q.library_title, 
  r.release_year, 
  e.id`;

const magazinesSQL = `
SELECT 
  m.id, 
  m.name as full_title, 
  z.mag_seo 
FROM 
  magazines m 
  INNER JOIN sc_magazines z ON m.id = z.id 
ORDER BY 
  m.name
`;

const entitiesSQL = `
SELECT 
  b.id, 
  b.name as full_title, 
  b.labeltype_id,
  b.country_id,
  lt.text as entity_type
FROM 
  labels b 
  INNER JOIN search_by_names n ON b.id = n.label_id 
  LEFT JOIN labeltypes lt ON lt.id = b.labeltype_id 
WHERE 
  b.id NOT IN (6738, 6773, 10531)
GROUP BY 
  b.id 
ORDER BY 
  b.name
`;

const groupsSQL = `
SELECT 
  g.id, 
  g.name as full_title, 
  t.text 
FROM 
  tags g 
  INNER JOIN tagtypes t ON g.tagtype_id = t.id 
ORDER BY 
  g.name, 
  t.text`;

const licensesSQL = `
SELECT 
  g.id, 
  g.name as full_title, 
  t.text 
FROM 
  licenses g 
  INNER JOIN licensetypes t ON g.licensetype_id = t.id 
ORDER BY 
  g.name, 
  t.text`;

const { Client, ClientOptions } = require("@elastic/elasticsearch");
const { Transport } = require("@elastic/transport");
let baseUrl = process.env.ES_HOST ? process.env.ES_HOST : "http://localhost:9200";
let path = process.env.ES_PATH ? process.env.ES_PATH : "";
let es_index = process.env.ES_INDEX ? process.env.ES_INDEX : "zxinfo-search-write";

console.log(`PARAMETERS:`);
console.log(`ES_HOST: ${baseUrl}`);
console.log(`ES_PATH: ${path}`);
console.log(`ES_URL: ${baseUrl}${path}`);
console.log(`ES_INDEX: ${es_index}`);
console.log(`ZXDB: ${process.env.ZXDB ? process.env.ZXDB : "zxdb"}`);

// then create a class, that extends Transport class to modify the path
class MTransport extends Transport {
  request(params, options, callback) {
    params.path = path + params.path; // <- append the path right here
    return super.request(params, options, callback);
  }
}

// and finally put the extended class on the options.
const client = new Client({
  node: baseUrl,
  log: "debug",
  Transport: MTransport,
});

var db = require("./dbConfig");

async function index(id, title, entry_seo, comment, context, xrt) {
  var zerofilled = ("0000000" + id).slice(-7);

  /**
   * INPUT:
   * 1) Full title
   * 2) Pair of words (The Duel: Test Drive) (Test Drive)
   * 3) Single words
   *
   * "The Duel: Test Drive II" =>
   * ["The Duel: Test Drive II"(20),
   *  "The Duel"(15),
   *  "Duel Test"(15),
   *  "Test Drive"(15),
   *  "Drive II"(15),
   *  "The", "Duel", "Test", "Drive", "II" (5)]
   *
   */

  // split title into "words"
  // const words = title.split(/[^A-Za-z0-9]/).filter((str) => /\w+/.test(str)); // filter out non words
  var regex = /([0-9\u0041-\u005A\u0061-\u007A\u00AA\u00B5\u00BA\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377\u037A-\u037D\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u0527\u0531-\u0556\u0559\u0561-\u0587\u05D0-\u05EA\u05F0-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u08A0\u08A2-\u08AC\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0977\u0979-\u097F\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C33\u0C35-\u0C39\u0C3D\u0C58\u0C59\u0C60\u0C61\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D60\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F4\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u1700-\u170C\u170E-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1877\u1880-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191C\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19C1-\u19C7\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4B\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1CE9-\u1CEC\u1CEE-\u1CF1\u1CF5\u1CF6\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2183\u2184\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2E2F\u3005\u3006\u3031-\u3035\u303B\u303C\u3041-\u3096\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FCC\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA67F-\uA697\uA6A0-\uA6E5\uA717-\uA71F\uA722-\uA788\uA78B-\uA78E\uA790-\uA793\uA7A0-\uA7AA\uA7F8-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA80-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uABC0-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]+)/g;

  // 44800 **/?** - no words found by regexp => words = null
  const words = title.match(regex) === null ? [] : title.match(regex) ;
  console.log(`WORDS: [${words}]`);
  /**
    var pairs = [];
    for (let index = 0; index < words.length - 1; index++) {
      const e1 = words[index];
      const e2 = words[index + 1];
      const e = `${e1} ${e2}`;
      pairs.push(e);
    }
   */

  var pairs = [];

  for (let index = 1; index < words.length - 1; index++) {
    var items = "";
    for (let index2 = index; index2 < words.length; index2++) {
      items = items + " " + words[index2];
    }
    pairs.push(items.trim());
  }

  for (let index = words.length - 1; index > 1; index--) {
    var items = "";
    for (let index2 = 0; index2 < index; index2++) {
      items = items + " " + words[index2];
    }
    pairs.push(items.trim());
  }

  // const inputs = ["input": {title}, ...pairs, ...words];
  var inputs = [
    {
      input: title,
      contexts: { genre: context, xrated: xrt, genre_xrated: [`${context}_${xrt}`, `ALL_${xrt}`] },
      weight: 20,
    },
  ];

  // for SOFTWARE entries, add ID to input as well 
  if (context === "SOFTWARE") {

    // exact match has high priority
    inputs.push({
      input: [`${zerofilled}`, `${id}`],
      contexts: { genre: context, xrated: xrt, genre_xrated: [`${context}_${xrt}`, `ALL_${xrt}`] },
      weight: 20,
    });

    // index 0002259 -> 002259, 02259, 2249, 249, 49 (NOT 9, as it would override single digit entries)
    var id_combos = [];
    for (let index = 1; index < zerofilled.length - 1; index++) {
      id_combos.push(zerofilled.slice(index));
    }

    // suffix has lower priority
    inputs.push({
      input: id_combos,
      contexts: { genre: context, xrated: xrt, genre_xrated: [`${context}_${xrt}`, `ALL_${xrt}`] },
      weight: 15,
    });
  }

  if (pairs.length > 0) {
    inputs.push({
      input: pairs,
      contexts: { genre: context, xrated: xrt, genre_xrated: [`${context}_${xrt}`, `ALL_${xrt}`] },
      weight: 15,
    });
  }

  inputs.push({
    input: words,
    contexts: { genre: context, xrated: xrt, genre_xrated: [`${context}_${xrt}`, `ALL_${xrt}`] },
    weight: 5,
  });

  // console.log(`t: ${title}`);
  // console.log(`w: ${words}`);
  // console.log(`p: ${pairs}`);
  // console.log(`${title} => ${JSON.stringify(inputs, null, 2)}`);

  await client.index({
    index: es_index,
    document: {
      title: inputs,
      id: zerofilled,
      fulltitle: title,
      entry_seo: entry_seo,
      comment: comment,
      type: context,
      xrated: xrt,
    },
  });
}

async function getTitles(query, context, connection) {
  var done = false;

  // COLLATE utf8_general_ci - ignore case on sorting/order
  connection.query(query, [], async function (error, results, fields) {
    if (error) {
      throw error;
    }
    var i = 0;
    for (; i < results.length; i++) {
      console.log(`${context} - [${results[i].id}] - ${results[i].full_title}(xrt: ${results[i].xrated})`);
      var comment = "";
      var entry_seo = "";
      var xrt = false;
      const year = results[i].release_year ? `(${results[i].release_year})` : "";
      switch (context) {
        case "SOFTWARE":
          entry_seo = results[i].entry_seo;
          if (results[i].pub_names) {
            var newStr = results[i].pub_names.replace(/<\/?[^>]+(>|$)/g, "");
            comment = `(${newStr})${year}[${results[i].machine_type_text}]`;
          } else {
            comment = `${year}[${results[i].machine_type_text}]`;
          }
          if (results[i].xrated === 1) {
            xrt = true;
          }
          break;
        case "HARDWARE":
        case "BOOK":
          entry_seo = results[i].entry_seo;
          if (results[i].pub_names) {
            var newStr = results[i].pub_names.replace(/<\/?[^>]+(>|$)/g, "");
            comment = `(${newStr})${year}`;
          } else {
            comment = `${year}`;
          }
          break;
        case "MAGAZINE":
          entry_seo = results[i].mag_seo;
          comment = "";
          break;
        case "ENTITY":
          const entity_type = results[i].entity_type ? `(${results[i].entity_type})` : "";
          const country = results[i].country_id ? `(${results[i].country_id})` : "";
          comment = `${entity_type}${country}`;
          break;
        case "GROUP":
        case "LICENSE":
          const group_text = results[i].text ? `(${results[i].text})` : "";
          comment = `${group_text}`;
          break;
        default:
          break;
      }
      await index(results[i].id, results[i].full_title.replace(/\[MOD\] /g, ""), entry_seo, comment, context, xrt);

      // if entry got entries, add them as well
      if (results[i].aliases) {
        const aliases = results[i].aliases.split(";;");
        for (let value of aliases) {
          const aliastitle = `${value} (${results[i].full_title.replace(/\[MOD\] /g, "")})`;
          console.log(`${context} - [${results[i].id}] - (alias)${aliastitle}(xrt: ${results[i].xrated})`);
          await index(results[i].id, aliastitle, entry_seo, comment, context, xrt);
        }
      }

    }
    done = true;
  });
  require("deasync").loopWhile(function () {
    return !done;
  });
  console.log("Finished!");
}

var connection = db.getConnection();
getTitles(softwareSQL, "SOFTWARE", connection).catch(console.log);
getTitles(hardwareSQL, "HARDWARE", connection).catch(console.log);
getTitles(booksSQL, "BOOK", connection).catch(console.log);
getTitles(magazinesSQL, "MAGAZINE", connection).catch(console.log);
getTitles(entitiesSQL, "ENTITY", connection).catch(console.log);
getTitles(groupsSQL, "GROUP", connection).catch(console.log);
getTitles(licensesSQL, "LICENSE", connection).catch(console.log);
db.closeConnection(connection);
