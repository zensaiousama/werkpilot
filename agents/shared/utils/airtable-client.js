const Airtable = require('airtable');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

let base = null;

function getBase() {
  if (!base) {
    Airtable.configure({ apiKey: process.env.AIRTABLE_API_KEY });
    base = Airtable.base(process.env.AIRTABLE_BASE_ID);
  }
  return base;
}

async function getRecords(tableName, filterFormula = '', maxRecords = 100) {
  const base = getBase();
  const records = [];
  const opts = { maxRecords };
  if (filterFormula) opts.filterByFormula = filterFormula;

  return new Promise((resolve, reject) => {
    base(tableName)
      .select(opts)
      .eachPage(
        (pageRecords, fetchNextPage) => {
          records.push(...pageRecords.map(r => ({ id: r.id, ...r.fields })));
          fetchNextPage();
        },
        (err) => (err ? reject(err) : resolve(records))
      );
  });
}

async function createRecord(tableName, fields) {
  const base = getBase();
  return new Promise((resolve, reject) => {
    base(tableName).create([{ fields }], (err, records) => {
      if (err) return reject(err);
      resolve(records[0]);
    });
  });
}

async function updateRecord(tableName, recordId, fields) {
  const base = getBase();
  return new Promise((resolve, reject) => {
    base(tableName).update([{ id: recordId, fields }], (err, records) => {
      if (err) return reject(err);
      resolve(records[0]);
    });
  });
}

module.exports = { getBase, getRecords, createRecord, updateRecord };
