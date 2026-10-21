#!/usr/bin/env node
/* Valida todos os pacotes de campanha (js/campaigns/*.js) sem abrir o navegador.
   Uso:  node tools/check-campaigns.mjs            (todos)     |   node tools/check-campaigns.mjs js/campaigns/minha.js */
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import path from "node:path";
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const dir = path.join(root, "js/campaigns");
const require = createRequire(import.meta.url);
const SPBCampaigns = require(path.join(dir, "registry.js"));
const files = process.argv.length > 2 ? process.argv.slice(2).map(f => path.resolve(f)) : readdirSync(dir).filter(f => f.endsWith(".js") && !["registry.js", "manifest.js"].includes(f) && !f.startsWith("_")).map(f => path.join(dir, f));
let bad = 0;
for (const file of files) {
  const errs = [], warns = [];
  const sandbox = { SPBCampaigns: { ...SPBCampaigns, register(def) { const r = SPBCampaigns.validate(def); errs.push(...r.errors); warns.push(...r.warns); try { return SPBCampaigns.register(def); } catch (e) { if (!r.errors.length) errs.push(e.message); } } }, console: { error() {}, warn() {}, log: console.log } };
  try { vm.runInNewContext(readFileSync(file, "utf8"), sandbox, { filename: file }); } catch (e) { errs.push("o arquivo não carregou: " + e.message); }
  const rel = path.relative(root, file);
  if (errs.length) { bad++; console.log(`✗ ${rel}`); errs.forEach(e => console.log("   erro:  " + e)); } else console.log(`✓ ${rel}`);
  warns.forEach(w => console.log("   aviso: " + w));
}
console.log(bad ? `\n${bad} pacote(s) com erro.` : "\nTodos os pacotes estão válidos.");
process.exit(bad ? 1 : 0);
