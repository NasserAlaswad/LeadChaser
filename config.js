const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '..', 'config', 'business.json');
const examplePath = path.join(__dirname, '..', 'config', 'business.example.json');

const activePath = fs.existsSync(configPath) ? configPath : examplePath;
const raw = fs.readFileSync(activePath, 'utf8');
const config = JSON.parse(raw);

if (activePath === examplePath) {
  console.warn('No config/business.json found — running on business.example.json. Copy it to business.json and edit before going live.');
}

module.exports = config;
