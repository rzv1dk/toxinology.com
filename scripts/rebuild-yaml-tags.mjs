import { readFile, writeFile } from "node:fs/promises";
import { loadRecords } from "./content.mjs";
import { TAG_GUIDE, TAG_PREFIX, diagnosticEffects, distributionCountries, prefixedTags } from "./tagging.mjs";

const managedPrefixes = Object.values(TAG_PREFIX).filter(prefix => prefix !== TAG_PREFIX.category);
let changed = 0;

for (const record of await loadRecords()) {
  const raw = await readFile(record.file, "utf8");
  const countries = distributionCountries(record.body).length ? distributionCountries(record.body) : (record.data.countries || []);
  const retained = (record.data.tags || []).filter(tag => !managedPrefixes.some(prefix => String(tag).startsWith(prefix)));
  const tags = [...new Set([
    `category:${record.data.subject}`,
    ...retained,
    ...prefixedTags(TAG_PREFIX.country, countries),
    ...prefixedTags(TAG_PREFIX.keyword, record.data.keywords || []),
    ...prefixedTags(TAG_PREFIX.diagnostic, diagnosticEffects(record.body))
  ])];
  let updated = raw.replace(/^countries:\s*.*$/m, `countries: ${JSON.stringify(countries)}`);
  updated = updated.replace(/(?:^# TAG GUIDE:.*\n^# keyword:.*\n^# Keep family,.*\n)?^tags:\s*.*$/m, `${TAG_GUIDE}\ntags: ${JSON.stringify(tags)}`);
  if (updated !== raw) {
    await writeFile(record.file, updated);
    changed += 1;
  }
}

console.log(`Rebuilt YAML navigation tags in ${changed} records.`);
