import path from "node:path";
import { access, readFile, readdir } from "node:fs/promises";
import { CONTENT_DIR, loadRecords, slugify } from "./content.mjs";
import { TAG_GUIDE, TAG_PREFIX, diagnosticEffects, distributionCountries } from "./tagging.mjs";

const required = ["id", "title", "scientific_name", "topic", "subject", "risk", "countries", "family", "genus", "species", "subspecies", "tags"];
const arrays = ["aliases", "countries", "keywords", "family", "genus", "species", "subspecies", "tags", "image_sources", "section_names"];
const risks = new Set(["No Risk", "Low Risk", "Mild Risk", "Moderate Risk", "High Risk", "Unknown Risk"]);
const records = await loadRecords();
const seen = new Map();
const errors = [];
const alwaysRequiredSections = ["Summary", "First Aid", "Migration provenance"];
const imagePattern = /\.(?:avif|gif|jpe?g|png|svg|webp)$/i;

const exists = async file => {
  try { await access(file); return true; } catch { return false; }
};

for (const record of records) {
  const sourceMarkdown = await readFile(record.file, "utf8");
  const relative = path.relative(CONTENT_DIR, record.file);
  const [topic, subject] = relative.split(path.sep);
  for (const field of required) if (record.data[field] === undefined || record.data[field] === "") errors.push(`${relative}: missing ${field}`);
  if (record.data.topic !== topic) errors.push(`${relative}: topic must match directory ${topic}`);
  if (record.data.subject !== subject) errors.push(`${relative}: subject must match directory ${subject}`);
  if (!risks.has(record.data.risk)) errors.push(`${relative}: unsupported risk ${record.data.risk}`);
  for (const field of arrays) if (!Array.isArray(record.data[field])) errors.push(`${relative}: ${field} must be a JSON-style YAML array`);
  const categoryTags = (record.data.tags || []).filter(tag => String(tag).startsWith("category:"));
  if (!categoryTags.length) errors.push(`${relative}: tags must contain at least one category: menu tag`);
  if (!categoryTags.includes(`category:${record.data.subject}`)) errors.push(`${relative}: tags must contain category:${record.data.subject} for its current subject folder`);
  if (!sourceMarkdown.includes(TAG_GUIDE)) errors.push(`${relative}: missing the contributor tag guide above tags`);
  const expectedCountries = distributionCountries(record.body);
  if (expectedCountries.length && JSON.stringify(record.data.countries) !== JSON.stringify(expectedCountries)) errors.push(`${relative}: countries must match the structured Distribution country list`);
  for (const country of record.data.countries || []) if (!(record.data.tags || []).includes(`${TAG_PREFIX.country}${country}`)) errors.push(`${relative}: tags missing country:${country}`);
  for (const keyword of record.data.keywords || []) if (!(record.data.tags || []).includes(`${TAG_PREFIX.keyword}${keyword}`)) errors.push(`${relative}: tags missing keyword:${keyword}`);
  for (const effect of diagnosticEffects(record.body)) if (!(record.data.tags || []).includes(`${TAG_PREFIX.diagnostic}${effect}`)) errors.push(`${relative}: tags missing diagnostic:${effect}`);
  if (seen.has(record.data.id)) errors.push(`${relative}: duplicate id also used by ${seen.get(record.data.id)}`);
  seen.set(record.data.id, relative);
  if (path.basename(relative) !== "index.md") errors.push(`${relative}: organism record must be named index.md`);
  const organismDirectory = path.basename(path.dirname(relative));
  const expectedDirectory = slugify(record.data.id);
  if (organismDirectory !== expectedDirectory) errors.push(`${relative}: organism directory must be ${expectedDirectory}`);

  const headings = [...record.body.matchAll(/^(#{2,4})\s+(.+)$/gm)].map(match => ({ level: match[1].length, name: match[2].trim() }));
  const sections = headings.filter(heading => heading.level === 2).map(heading => heading.name);
  const duplicateSections = sections.filter((section, index) => sections.indexOf(section) !== index);
  if (duplicateSections.length) errors.push(`${relative}: duplicate sections: ${[...new Set(duplicateSections)].join(", ")}`);
  for (const section of alwaysRequiredSections) if (!sections.includes(section)) errors.push(`${relative}: missing ## ${section}`);
  for (const section of record.data.section_names || []) if (!sections.includes(section)) errors.push(`${relative}: section_names lists missing ## ${section}`);
  for (let index = 1; index < headings.length; index += 1) {
    if (headings[index].level > headings[index - 1].level + 1) errors.push(`${relative}: heading level jumps from ${headings[index - 1].level} to ${headings[index].level} at ${headings[index].name}`);
  }

  const summary = record.body.match(/(?:^|\n)## Summary\n+([\s\S]*?)(?=\n## |$)/)?.[1] || "";
  if (!/^###\s+\S/m.test(summary)) errors.push(`${relative}: Summary must contain at least one structured fact`);

  const firstAid = record.body.match(/(?:^|\n)## First Aid\n+([\s\S]*?)(?=\n## |$)/)?.[1] || "";
  const orderedSteps = [...firstAid.matchAll(/^\d+\.\s+\S/gm)].length;
  if (!orderedSteps) errors.push(`${relative}: First Aid must contain a numbered list`);
  if (/^[-*]\s+/m.test(firstAid)) errors.push(`${relative}: First Aid contains bullets; use numbered steps`);
  const firstAidListBlocks = firstAid.split(/\n\s*\n/).filter(block => /^\d+\.\s+/m.test(block));
  if (firstAidListBlocks.some(block => block.split("\n").some(line => line.trim() && !/^\d+\.\s+/.test(line)))) errors.push(`${relative}: malformed First Aid numbered list`);

  const diagnosis = record.body.match(/(?:^|\n)## Diagnosis\n+([\s\S]*?)(?=\n## |$)/)?.[1] || "";
  if (!diagnosis) errors.push(`${relative}: missing ## Diagnosis`);
  for (const effectGroup of ["Likely Effects", "Possible Effects", "Effects Unlikely to be observed"]) {
    const plainMarker = new RegExp(`^${effectGroup.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "m");
    if (plainMarker.test(diagnosis)) errors.push(`${relative}: Diagnosis ${effectGroup} must be a level-three heading`);
    const subsection = diagnosis.match(new RegExp(`^### ${effectGroup.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\n([\\s\\S]*?)(?=^### |$)`, "m"))?.[1];
    if (subsection !== undefined) {
      const lines = subsection.split("\n").map(line => line.trim()).filter(Boolean);
      if (!lines.length || lines.some(line => !/^[-*]\s+\S/.test(line))) errors.push(`${relative}: Diagnosis ${effectGroup} must be an unordered list`);
    }
  }
  if (!/^### Effects Unlikely to be observed$/m.test(diagnosis)) errors.push(`${relative}: Diagnosis missing structured Effects Unlikely to be observed`);
  if (/^### Lab Results$/m.test(diagnosis) && !/^####\s+\S/m.test(diagnosis.match(/^### Lab Results\n([\s\S]*?)(?=^### |$)/m)?.[1] || "")) errors.push(`${relative}: Diagnosis Lab Results must contain level-four result labels`);

  const organismPath = path.dirname(record.file);
  const imagesPath = path.join(organismPath, "_images");
  const placeholderName = record.data.subject === "snakes" ? "placeholder-snake.png" : record.data.subject === "spiders" ? "placeholder-spider.png" : record.data.subject === "scorpions" ? "placeholder-scorpion.png" : `placeholder-${record.data.subject}.png`;
  const recordJsonPath = path.join(organismPath, "record.json");
  const manifestPath = path.join(imagesPath, "manifest.json");
  if (!await exists(imagesPath)) errors.push(`${relative}: missing _images directory`);
  if (!await exists(path.join(imagesPath, placeholderName))) errors.push(`${relative}: missing ${placeholderName}`);
  if (!await exists(recordJsonPath)) errors.push(`${relative}: missing record.json`);
  if (!await exists(manifestPath)) errors.push(`${relative}: missing _images/manifest.json`);
  if (await exists(recordJsonPath)) {
    const bundle = JSON.parse(await readFile(recordJsonPath, "utf8"));
    for (const field of required) if (JSON.stringify(bundle[field]) !== JSON.stringify(record.data[field])) errors.push(`${relative}: record.json ${field} does not match YAML`);
    if (bundle.content_markdown !== record.body) errors.push(`${relative}: record.json content_markdown is stale`);
  }
  if (await exists(manifestPath)) {
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    const imageFiles = (await readdir(imagesPath, { withFileTypes: true })).filter(entry => entry.isFile() && imagePattern.test(entry.name)).map(entry => entry.name).sort();
    if (manifest.organism !== record.data.id) errors.push(`${relative}: image manifest organism does not match id`);
    if (JSON.stringify([...(manifest.files || [])].sort()) !== JSON.stringify(imageFiles)) errors.push(`${relative}: image manifest files do not match _images contents`);
  }
}

if (records.length !== 547) errors.push(`catalogue: expected 547 records, found ${records.length}`);

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`Validated ${records.length} Markdown records.`);
