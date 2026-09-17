const fs = require('fs');
const path = require('path');
const config = require('./config');

const dataDir = path.join(__dirname, '..', 'data');
const dataFile = path.join(dataDir, `${config.businessId}.json`);

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(dataFile)) fs.writeFileSync(dataFile, JSON.stringify({ quotes: [], nextId: 1 }, null, 2));

function readAll() {
  return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
}

function writeAll(data) {
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

function listQuotes() {
  return readAll().quotes;
}

function getQuote(id) {
  return readAll().quotes.find(q => q.id === id);
}

function createQuote(fields) {
  const data = readAll();
  const quote = {
    id: data.nextId,
    status: 'open',
    draft: null,
    log: [],
    createdAt: new Date().toISOString(),
    ...fields
  };
  data.quotes.push(quote);
  data.nextId += 1;
  writeAll(data);
  return quote;
}

function updateQuote(id, patch) {
  const data = readAll();
  const idx = data.quotes.findIndex(q => q.id === id);
  if (idx === -1) return null;
  data.quotes[idx] = { ...data.quotes[idx], ...patch };
  writeAll(data);
  return data.quotes[idx];
}

function appendLog(id, line) {
  const data = readAll();
  const idx = data.quotes.findIndex(q => q.id === id);
  if (idx === -1) return null;
  data.quotes[idx].log.push({ line, at: new Date().toISOString() });
  writeAll(data);
  return data.quotes[idx];
}

module.exports = { listQuotes, getQuote, createQuote, updateQuote, appendLog };
