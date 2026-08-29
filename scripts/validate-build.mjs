import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { ROOT, loadRecords } from "./content.mjs";

const OUTPUT = path.join(ROOT, "public");
const records = await loadRecords();
const errors = [];
const exists = async file => { try { await access(file); return true; } catch { return false; } };

for (const required of [path.join(ROOT, "index.html"), path.join(OUTPUT, "index.html"), path.join(OUTPUT, "search-index.json"), path.join(OUTPUT, "404.html")]) {
  if (!await exists(required)) errors.push(`missing generated file ${path.relative(ROOT, required)}`);
}

const searchIndex = JSON.parse(await readFile(path.join(OUTPUT, "search-index.json"), "utf8"));
if (searchIndex.length !== records.length) errors.push(`search index has ${searchIndex.length} records; expected ${records.length}`);
const searchIds = new Set(searchIndex.map(record => record.id));
const searchById = new Map(searchIndex.map(record => [record.id, record]));

for (const record of records) {
  const directory = path.join(OUTPUT, "record", record.data.id);
  const htmlPath = path.join(directory, "index.html");
  const jsonPath = path.join(directory, "record.json");
  const imagesPath = path.join(directory, "_images");
  if (!searchIds.has(record.data.id)) errors.push(`${record.data.id}: missing from search index`);
  const sourceImageFiles = (await readdir(path.join(path.dirname(record.file), "_images"))).filter(filename => /\.(?:avif|gif|jpe?g|png|svg|webp)$/i.test(filename));
  const mainImage = sourceImageFiles.find(filename => path.parse(filename).name.toLowerCase() === "main");
  const placeholderName = record.data.subject === "snakes" ? "placeholder-snake.png" : record.data.subject === "spiders" ? "placeholder-spider.png" : record.data.subject === "scorpions" ? "placeholder-scorpion.png" : `placeholder-${record.data.subject}.png`;
  const expectedCardImage = `/record/${record.data.id}/_images/${mainImage || placeholderName}`;
  if (searchById.get(record.data.id)?.card_image !== expectedCardImage) errors.push(`${record.data.id}: homepage card image does not follow main-image/placeholder rules`);
  for (const file of [htmlPath, jsonPath, path.join(imagesPath, "manifest.json")]) if (!await exists(file)) errors.push(`${record.data.id}: missing ${path.relative(directory, file)}`);
  if (await exists(htmlPath)) {
    const html = await readFile(htmlPath, "utf8");
    const sourceSections = [...record.body.matchAll(/^## ([^\n]+)$/gm)].map(match => match[1]).filter(section => !["Summary"].includes(section));
    for (const section of sourceSections) if (!html.includes(`<summary>${section}`) && !["Migration provenance"].includes(section)) errors.push(`${record.data.id}: generated page missing ${section}`);
    if (!html.includes('<ol>')) errors.push(`${record.data.id}: generated First Aid is not an ordered list`);
    const diagnosisHtml = html.match(/<summary>Diagnosis[\s\S]*?<div class="section-content">([\s\S]*?)<\/div>\s*<\/details>/)?.[1] || "";
    if (!/<h3(?:\s[^>]*)?>Effects Unlikely to be observed<\/h3>/.test(diagnosisHtml)) errors.push(`${record.data.id}: generated Diagnosis is missing its legacy subsection structure`);
    if (!diagnosisHtml.includes("<ul>")) errors.push(`${record.data.id}: generated Diagnosis effects are not unordered lists`);
  }
  if (await exists(jsonPath)) {
    const generated = JSON.parse(await readFile(jsonPath, "utf8"));
    if (generated.content_markdown !== record.body) errors.push(`${record.data.id}: generated record.json content is stale`);
  }
  if (await exists(imagesPath)) {
    const sourceImages = (await readdir(path.join(path.dirname(record.file), "_images"))).sort();
    const generatedImages = (await readdir(imagesPath)).sort();
    if (JSON.stringify(sourceImages) !== JSON.stringify(generatedImages)) errors.push(`${record.data.id}: generated _images contents differ from source`);
  }
}

const generatedDirectories = (await readdir(path.join(OUTPUT, "record"), { withFileTypes: true })).filter(entry => entry.isDirectory()).length;
if (generatedDirectories !== records.length) errors.push(`public/record has ${generatedDirectories} organism folders; expected ${records.length}`);

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`Completely validated ${records.length} source records, generated pages, JSON bundles, image folders, and search entries.`);
