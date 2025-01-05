/**
 * zxinfo-search index for autocomplete - used by quick-search at SC
 * 
 * To update zxinfo-api-v5 in production
 * 
 * > cd search-index/mappings
 * > ES_HOST=http://internal.zxinfo.dk/e817 ./create_index.sh
 * > cd ..
 * > nvm use v20.16.0
 * > ES_HOST=http://internal.zxinfo.dk ES_PATH="/e817" ZXDB=zxdb-1.0.204 node index.js
 */

"use strict";

const softwareSQL = `
  SELECT 
    z.full_title, 
    z.entry_seo, 
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
const { Transport } = require('@elastic/transport');
let baseUrl = process.env.ES_HOST ? process.env.ES_HOST : "http://localhost:9200";
let path = process.env.ES_PATH ? process.env.ES_PATH : "";
let es_index = process.env.ES_INDEX ? process.env.ES_INDEX : "zxinfo-search-write";

console.log(`PARAMETERS:`);
console.log(`ES_HOST: ${baseUrl}`);
console.log(`ES_PATH: ${path}`);
console.log(`ES_URL: ${baseUrl}${path}`);
console.log(`ES_INDEX: ${es_index}`);
console.log(`ZXDB: ${process.env.ZXDB ? process.env.ZXDB: "zxdb"}`);


// then create a class, that extends Transport class to modify the path
class MTransport extends Transport {
  request(params, options, callback) {
    params.path = path + params.path // <- append the path right here
    return super.request(params, options, callback)
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
  const words = title.split(/[^A-Za-z0-9]/).filter((str) => /\w+/.test(str)); // filter out non words

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
  var inputs = [{ input: title, contexts: { genre: context, xrated: xrt, genre_xrated: [`${context}_${xrt}`, `ALL_${xrt}`] }, weight: 20 }];
  inputs.push({ input: pairs, contexts: { genre: context, xrated: xrt, genre_xrated: [`${context}_${xrt}`, `ALL_${xrt}`] }, weight: 15 });
  inputs.push({ input: words, contexts: { genre: context, xrated: xrt, genre_xrated: [`${context}_${xrt}`, `ALL_${xrt}`] }, weight: 5 });

  /**
  console.log(`t: ${title}`);
  console.log(`w: ${words}`);
  console.log(`p: ${pairs}`);
  console.log(`${title} => ${JSON.stringify(inputs, null, 2)}`);
 */

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
      await index(results[i].id, results[i].full_title, entry_seo, comment, context, xrt);
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
