#!/usr/bin/env node
import fs from 'fs';

const path = new URL('../data.json', import.meta.url);
const filePath = fs.existsSync('./data.json') ? './data.json' : new URL('../data.json', import.meta.url);

const backupPath = typeof filePath === 'string' ? `${filePath}.bak` : null;
if (backupPath) {
  try { fs.copyFileSync(filePath, backupPath); } catch {}
}

let existing = {};
try { existing = JSON.parse(fs.readFileSync(filePath, 'utf-8')); } catch { existing = {}; }

const stdin = await new Promise(resolve => {
  let data = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => (data += chunk));
  process.stdin.on('end', () => resolve(data));
});

let patch = {};
try { patch = JSON.parse(stdin); } catch {
  console.error('Invalid JSON from stdin');
  process.exit(1);
}

const merged = { ...existing, ...patch };
fs.writeFileSync(filePath, JSON.stringify(merged, null, 2));
console.log('data.json updated. Backup saved to', backupPath);
