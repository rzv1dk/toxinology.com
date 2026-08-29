export const TAG_PREFIX = {
  category: "category:",
  country: "country:",
  keyword: "keyword:",
  diagnostic: "diagnostic:"
};

export const TAG_GUIDE = [
  "# TAG GUIDE: category:<menu> controls the organism menu; country:<name> controls Location.",
  "# keyword:<term> adds a search suggestion; diagnostic:<effect> adds a questionnaire option.",
  "# Keep family, genus, species, and subspecies as plain tags. Multiple tags are allowed."
].join("\n");

const decodeEntities = value => String(value)
  .replaceAll("&#39;", "'")
  .replaceAll("&amp;", "&")
  .replaceAll("&quot;", '"')
  .replaceAll("&nbsp;", " ");

export function distributionCountries(body) {
  const distribution = body.match(/(?:^|\n)## Distribution\n+([\s\S]*?)(?=\n## |$)/)?.[1] || "";
  const countries = distribution.match(/^### Countries\n+([\s\S]*?)(?=\n### |$)/m)?.[1] || "";
  const catalogueList = countries.split(/\n\s*\n/)[0]?.trim() || "";
  return [...new Set(catalogueList.split(/\s*,\s*/).map(decodeEntities).map(value => value.trim()).filter(Boolean))];
}

export function diagnosticEffects(body) {
  const diagnosis = body.match(/(?:^|\n)## Diagnosis\n+([\s\S]*?)(?=\n## |$)/)?.[1] || "";
  const effects = [];
  for (const heading of ["Likely Effects", "Possible Effects"]) {
    const subsection = diagnosis.match(new RegExp(`^### ${heading}\\n([\\s\\S]*?)(?=^### |$)`, "m"))?.[1] || "";
    for (const match of subsection.matchAll(/^[-*]\s+(.+)$/gm)) effects.push(match[1].trim());
  }
  return [...new Set(effects)];
}

export const prefixedTags = (prefix, values) => values.map(value => `${prefix}${value}`);
