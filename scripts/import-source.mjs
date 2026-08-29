import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { CONTENT_DIR, slugify } from "./content.mjs";
import { TAG_GUIDE } from "./tagging.mjs";

const source = process.argv[2];
if (!source) throw new Error("Usage: npm run import:source -- /path/to/source.json");
const rows = JSON.parse(await readFile(path.resolve(source), "utf8"));
const used = new Set();

function uniqueId(row) {
  const base = slugify(row.name || row.taxonomy);
  let id = base;
  if (used.has(id)) id = `${base}-${slugify(row.taxonomy)}`;
  let suffix = 2;
  while (used.has(id)) id = `${base}-${slugify(row.taxonomy)}-${suffix++}`;
  used.add(id);
  return id;
}

for (const row of rows) {
  const id = uniqueId(row);
  const topic = "organisms";
  const subject = slugify(row.category);
  const directory = path.join(CONTENT_DIR, topic, subject, id);
  await mkdir(directory, { recursive: true });
  const yaml = {
    id,
    title: row.name.trim(),
    scientific_name: row.taxonomy.trim(),
    aliases: [],
    family: [],
    genus: [],
    species: [],
    subspecies: [],
    tags: [`category:${subject}`, "country:Australia", `keyword:${subject}`, `keyword:${row.risk || "Unknown Risk"}`],
    topic,
    subject,
    risk: row.risk || "Unknown Risk",
    countries: ["Australia"],
    keywords: [subject, row.risk || "Unknown Risk"],
    image_source: row.image || "",
    image_sources: row.image ? [row.image] : [],
    section_names: [],
    source_url: "http://54.253.37.47/",
    source_accessed: "2026-08-29",
    review_status: "migrated-unreviewed"
  };
  const frontMatter = Object.entries(yaml).map(([key, value]) => `${key === "tags" ? `${TAG_GUIDE}\n` : ""}${key}: ${JSON.stringify(value)}`).join("\n");
  const body = `Risk classification: **${row.risk || "Unknown Risk"}**.\n\nThis record was migrated from the Australian catalogue on the legacy Toxinology.com application. Clinical detail should be reviewed against the source before use.`;
  await writeFile(path.join(directory, "index.md"), `---\n${frontMatter}\n---\n\n${body}\n`);
}
console.log(`Imported ${rows.length} records.`);
