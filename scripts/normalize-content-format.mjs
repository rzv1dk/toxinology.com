import { readFile, writeFile } from "node:fs/promises";
import { loadRecords } from "./content.mjs";

const levelThree = {
  Diagnosis: ["Likely Effects", "Possible Effects", "Effects Unlikely to be observed", "Lab Results"],
  "Medical Treatment": ["Management in Detail"],
  Antivenom: ["Antivenom Therapy", "Antivenom Dosage", "Antivenom Reactions", "Adverse Antivenom Reaction Management", "Known Antivenoms"],
  "Clinical Effects": ["Special Risk Groups", "Specific Effects Relating to Body Systems or Venom Types"],
  Description: ["Adult Length", "Coloration & Markings", "Head Scales", "Body Scales", "Breeding", "Dentition", "Habits", "Prey", "Taxonomy Synonomy"],
  Distribution: ["Region", "Countries", "Habitat"],
  Venom: ["Venom Components", "Crude Venom", "Average Venom Quantity", "Maximum Venom Quantity", "Myotoxins", "Neurotoxins Channel Toxins", "Other ld50 Estimates", "Preferred ld50 Estimate", "Component ld50", "Venom Activity", "Haematological Haemorrhagins"]
};

const levelFour = {
  Diagnosis: ["Absolute Lymphopenia", "aPaO2", "aPTT", "Creatine Kinase (CK)", "Creatinine", "FDP/XDP/D-dimer", "Fibrinogen", "Haemoglobin (Hb)", "Potassium (K)", "Platelets", "PT/INR", "Urea", "Whole Blood Clotting Time", "White Cell Count (WCC)"],
  "Medical Treatment": ["Immediate Effects Management", "Approach to Management", "Follow Up", "Local Effects Management", "Systemic Effects Management", "Cardiotoxin Effects Management", "Haematologic Effects Management", "Haematologic Other Effects Management", "Important Laboratory Test", "Myotoxic Effects Management", "Necrotoxin Effects Management", "Neurotoxic Excitatory Effects Management", "Other Neurotoxic Effects Management", "Neurotoxic Paralytic Effects Management", "Other Issues in Treatment", "Other Specific Effects Management", "Renal Effects Management"],
  Antivenom: ["NOTE: Order of antivenoms is not indicitive of preference.", "Description", "Comments", "Recommended Dose", "Source Species", "Coverage Species", "Storage Type", "type", "Status", "Immunisation Host", "Administration Route", "Volume", "Initial Dose", "Local Cost", "Storage Life", "Language on Label", "Related Information", "References"],
  "Clinical Effects": ["Children", "Pregnancy", "Elderly", "Cardiotoxicity", "Coagulopathy", "System Effects", "Local Effects", "Necrosis", "Myotoxicity", "Neurotoxic Paralysis", "Renal Damage", "Untreated Lethality", "Venom Anticoagulants", "Venom Cardiotoxins", "Venom Haemorrhagins", "Venom Myotoxins", "Venom Necrotoxins", "Venom Nephrotoxins", "Venom Neurotoxins", "Venom Other", "Venom Procoagulants", "Other"],
  Description: ["Mid Body Scales", "Subcaudal Scales", "Ventral Scales", "Anal Scale (Single or Divided)"]
};

const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function promoteHeadings(content, names, level) {
  for (const name of names || []) {
    const pattern = new RegExp(`(^|\\n)(?:#{3,4}\\s+)?${escapeRegExp(name)}(?=\\n|$)`, "g");
    content = content.replace(pattern, `$1${"#".repeat(level)} ${name}`);
  }
  return content;
}

function listifyMultilineBlocks(content) {
  return content.split(/\n\s*\n/).map(block => {
    const lines = block.split("\n").map(line => line.trim()).filter(Boolean);
    if (lines.length < 2) return block.trim();
    return lines.map(line => `1. ${line.replace(/^(?:[-*]|\d+\.)\s+/, "")}`).join("\n");
  }).join("\n\n");
}

function listifyAfterHeading(content, heading) {
  const pattern = new RegExp(`(### ${escapeRegExp(heading)}\\n)(?!\\n)([\\s\\S]*?)(?=\\n#{3,4} |\\n\\n|$)`);
  return content.replace(pattern, (_, title, body) => {
    const lines = body.split("\n").map(line => line.trim()).filter(Boolean);
    return `${title}\n${lines.map(line => /^[-*]\s+/.test(line) ? line : `- ${line}`).join("\n")}`;
  });
}

function listifyDiagnosisEffects(content, heading) {
  const pattern = new RegExp(`(### ${escapeRegExp(heading)}\\n)([\\s\\S]*?)(?=\\n### |$)`);
  return content.replace(pattern, (_, title, body) => {
    const lines = body.split("\n").map(line => line.trim()).filter(Boolean);
    return `${title}${lines.map(line => /^[-*]\s+/.test(line) ? line : `- ${line}`).join("\n")}`;
  });
}

function extractGalleryCaptions(markdown) {
  const gallery = markdown.match(/(?:^|\n)## Gallery and source captions\n+([\s\S]*?)(?=\n## |$)/)?.[1] || "";
  return new Set(gallery.split("\n").map(line => line.trim()).filter(line => line && !/^#{1,6}\s+/.test(line) && !/^Source:\s+/.test(line)));
}

function removeDuplicatedDiagnosisCaptions(content, galleryCaptions) {
  const blocks = content.trim().split(/\n\s*\n/);
  const leadingLines = (blocks[0] || "").split("\n").map(line => line.trim()).filter(Boolean);
  if (leadingLines.length && leadingLines.every(line => galleryCaptions.has(line))) blocks.shift();
  return blocks.join("\n\n");
}

function normalizeSection(name, content, galleryCaptions) {
  let normalized = content.trim();
  if (name === "Diagnosis") normalized = removeDuplicatedDiagnosisCaptions(normalized, galleryCaptions);
  if (name === "First Aid") normalized = listifyMultilineBlocks(normalized);
  normalized = promoteHeadings(normalized, levelThree[name], 3);
  normalized = promoteHeadings(normalized, levelFour[name], 4);
  if (name === "Diagnosis") {
    for (const heading of ["Likely Effects", "Possible Effects", "Effects Unlikely to be observed"]) {
      normalized = listifyDiagnosisEffects(normalized, heading);
    }
  }
  if (name === "Venom") normalized = listifyAfterHeading(normalized, "Venom Components");
  if (name === "Description") normalized = listifyAfterHeading(normalized, "Taxonomy Synonomy");
  if (name === "Venom") normalized = normalized.replace(/\n- Crude Venom\n/g, "\n\n### Crude Venom\n");
  return normalized;
}

let changed = 0;
for (const record of await loadRecords()) {
  const raw = await readFile(record.file, "utf8");
  const galleryCaptions = extractGalleryCaptions(raw);
  const normalized = raw.replace(/(^## ([^\n]+)\n+)([\s\S]*?)(?=^## |$(?![\s\S]))/gm, (whole, heading, name, content) => {
    const replacement = `${heading}${normalizeSection(name.trim(), content, galleryCaptions)}\n\n`;
    return replacement === whole ? whole : replacement;
  }).trimEnd() + "\n";
  if (normalized !== raw) {
    await writeFile(record.file, normalized);
    changed += 1;
  }
}

console.log(`Normalized structured Markdown in ${changed} records.`);
