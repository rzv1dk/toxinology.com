import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ROOT, loadRecords } from "./content.mjs";

const records = await loadRecords();
const IMAGE_FILE = /\.(?:avif|gif|jpe?g|png|svg|webp)$/i;

for (const record of records) {
  const directory = path.dirname(record.file);
  const imageDirectory = path.join(directory, "_images");
  const relativeSource = path.relative(ROOT, record.file).replaceAll(path.sep, "/");
  const bundle = {
    ...record.data,
    content_markdown: record.body,
    source_file: relativeSource
  };
  await mkdir(imageDirectory, { recursive: true });
  const imageFiles = (await readdir(imageDirectory, { withFileTypes: true }))
    .filter(entry => entry.isFile() && IMAGE_FILE.test(entry.name))
    .map(entry => entry.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const media = {
    organism: record.data.id,
    files: imageFiles,
    legacy_sources: record.data.image_sources || (record.data.image_source ? [record.data.image_source] : []),
    note: "Every supported image file in this folder is copied and displayed automatically on the organism page."
  };
  await writeFile(path.join(directory, "record.json"), `${JSON.stringify(bundle, null, 2)}\n`);
  await writeFile(path.join(imageDirectory, "manifest.json"), `${JSON.stringify(media, null, 2)}\n`);
}

console.log(`Exported ${records.length} self-contained organism bundles.`);
