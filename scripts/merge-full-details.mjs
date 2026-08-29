import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadRecords } from "./content.mjs";
import { TAG_GUIDE, TAG_PREFIX, diagnosticEffects, distributionCountries, prefixedTags } from "./tagging.mjs";

const [detailsPath, cardsPath] = process.argv.slice(2);
if (!detailsPath || !cardsPath) throw new Error("Usage: node scripts/merge-full-details.mjs <details.json> <ordered-cards.json>");
const details = JSON.parse(await readFile(path.resolve(detailsPath), "utf8"));
const cards = JSON.parse(await readFile(path.resolve(cardsPath), "utf8"));
const records = await loadRecords();
const normal = value => String(value || "").normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
const key = (title, scientific) => `${normal(title)}\u001f${normal(scientific)}`;
const byIdentity = new Map();
for (const record of records) {
  const identity = key(record.data.title, record.data.scientific_name);
  if (!byIdentity.has(identity)) byIdentity.set(identity, []);
  byIdentity.get(identity).push(record);
}
const values = input => input ? [...new Set(String(input).split(/\s*(?:,|;|\n)\s*/).map(value => value.trim()).filter(Boolean))] : [];
const cleanText = input => String(input || "").replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
const aliases = (title, primary) => [...new Set(String(title || "").split(/\s*,\s*/).map(value => value.trim()).filter(value => value && normal(value) !== normal(primary)))];
const yaml = data => Object.entries(data).map(([name, value]) => `${name === "tags" ? `${TAG_GUIDE}\n` : ""}${name}: ${JSON.stringify(value)}`).join("\n");
const used = new Set();
const errors = [];

for (const detail of details) {
  const card = cards[detail.index];
  const record = card && byIdentity.get(key(card.name, card.taxonomy))?.shift();
  if (!record) { errors.push(`No Markdown record for source index ${detail.index}: ${card?.name || detail.title}`); continue; }
  const family = values(detail.taxonomy.family);
  const genus = values(detail.taxonomy.genus);
  const species = values(detail.taxonomy.species);
  const subspecies = values(detail.taxonomy.subspecies);
  const tags = [...new Set([`category:${record.data.subject}`, ...family, ...genus, ...species, ...subspecies])];
  const imageSources = detail.gallery.map(image => image.src).filter(Boolean);
  const sectionNames = Object.entries(detail.sections).filter(([, text]) => cleanText(text)).map(([name]) => name);
  let data = {
    ...record.data,
    aliases: aliases(detail.title, record.data.title),
    family, genus, species, subspecies, tags,
    keywords: [...new Set([...(record.data.keywords || []), ...tags])],
    image_source: imageSources.find(source => !/ML\d+\.gif$/i.test(source)) || record.data.image_source || "",
    image_sources: imageSources,
    section_names: sectionNames,
    source_index: detail.index,
    review_status: "full-legacy-migration-unreviewed"
  };
  const parts = [];
  const summary = Object.entries(detail.summary).filter(([, text]) => cleanText(text));
  if (summary.length) {
    parts.push("## Summary");
    for (const [name, text] of summary) parts.push(`### ${name}\n\n${cleanText(text)}`);
  }
  for (const [name, text] of Object.entries(detail.sections)) {
    const content = cleanText(text);
    if (content) parts.push(`## ${name}\n\n${content}`);
  }
  if (detail.gallery.length) {
    parts.push("## Gallery and source captions");
    detail.gallery.forEach((image, index) => parts.push(`### Image ${index + 1}\n\nSource: ${image.src || "Not recorded"}${image.caption ? `\n\n${cleanText(image.caption)}` : ""}`));
  }
  parts.push("## Migration provenance\n\nThis content was extracted from the Australian catalogue in the legacy Toxinology.com application. It has not yet received post-migration medical or editorial review.");
  const body = parts.join("\n\n");
  const countries = distributionCountries(body).length ? distributionCountries(body) : (data.countries || []);
  data = { ...data, countries, tags: [...new Set([...tags, ...prefixedTags(TAG_PREFIX.country, countries), ...prefixedTags(TAG_PREFIX.keyword, data.keywords || []), ...prefixedTags(TAG_PREFIX.diagnostic, diagnosticEffects(body))])] };
  await writeFile(record.file, `---\n${yaml(data)}\n---\n\n${body}\n`);
  used.add(record.file);
}

if (errors.length) throw new Error(errors.join("\n"));
if (used.size !== records.length) throw new Error(`Updated ${used.size} of ${records.length} Markdown records`);
console.log(`Merged complete source details into ${used.size} Markdown records.`);
