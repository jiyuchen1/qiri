#!/usr/bin/env node
import fs from 'fs';

const filePath = fs.existsSync('./data.json') ? './data.json' : new URL('../data.json', import.meta.url);
let data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

// Ensure top-level namespaces exist
data.containmentObjects = data.containmentObjects || [];
data.skills = data.skills || [];

// Example migration: add links derived from containmentObjects.skills
const links = [];
for (const co of data.containmentObjects) {
  for (const sid of co.skills || []) {
    links.push({ source: co.id, target: sid });
  }
}
data.links = links;

fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
console.log('Migration complete. links[] synthesized from containmentObjects.skills');
