import { cp, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { ROOT, escapeHtml, loadRecords, markdownToHtml, slugify } from "./content.mjs";

const PUBLISHED = path.join(ROOT, "public");
const OUTPUT = path.join(ROOT, ".public-build");
const PREVIOUS = path.join(ROOT, ".public-previous");
const STYLE = path.join(ROOT, "style");
const records = (await loadRecords()).sort((a, b) => (a.data.source_index ?? Number.MAX_SAFE_INTEGER) - (b.data.source_index ?? Number.MAX_SAFE_INTEGER) || a.data.title.localeCompare(b.data.title));
await rm(OUTPUT, { recursive: true, force: true });
await mkdir(OUTPUT, { recursive: true });
await cp(STYLE, OUTPUT, { recursive: true });

const strip = text => text.replace(/[#*`\[\]()]/g, " ").replace(/\s+/g, " ").trim();
const IMAGE_FILE = /\.(?:avif|gif|jpe?g|png|svg|webp)$/i;
const imageCaption = filename => path.basename(filename, path.extname(filename)).replaceAll(/[-_]+/g, " ").replace(/\b\w/g, character => character.toUpperCase());
const placeholderNames = {
  snakes: "placeholder-snake.png",
  scorpions: "placeholder-scorpion.png",
  spiders: "placeholder-spider.png",
  "other-land": "placeholder-other-land.png",
  "other-aquatic": "placeholder-other-aquatic.png"
};
const index = await Promise.all(records.map(async ({ data, body, file }) => {
  const localImages = (await readdir(path.join(path.dirname(file), "_images"), { withFileTypes: true }))
    .filter(entry => entry.isFile() && IMAGE_FILE.test(entry.name))
    .map(entry => entry.name);
  const mainImage = localImages.find(filename => path.parse(filename).name.toLowerCase() === "main");
  const cardFilename = mainImage || placeholderNames[data.subject];
  return {
    id: data.id,
    title: data.title,
    scientific_name: data.scientific_name,
    aliases: data.aliases || [],
    family: data.family || [],
    genus: data.genus || [],
    species: data.species || [],
    subspecies: data.subspecies || [],
    tags: data.tags || [],
    topic: data.topic,
    subject: data.subject,
    risk: data.risk,
    countries: data.countries || [],
    keywords: data.keywords || [],
    image_source: data.image_source || "",
    card_image: `/record/${data.id}/_images/${cardFilename}`,
    card_image_is_placeholder: !mainImage,
    href: `/record/${data.id}/`,
    text: strip(body)
  };
}));

const tagOptions = prefix => [...new Set(index.flatMap(record => record.tags).filter(tag => tag.startsWith(prefix)))]
  .map(tag => ({ tag, label: tag.slice(prefix.length), count: index.filter(record => record.tags.includes(tag)).length }))
  .sort((a, b) => a.label.localeCompare(b.label));
const countryOptions = tagOptions("country:");
const diagnosticOptions = tagOptions("diagnostic:");
const keywordOptions = tagOptions("keyword:");
const diagnosticPresentation = {
  "Direct Cardiotoxin Effect": ["Heart or circulation effects", "Direct cardiotoxic effects"],
  "Abnormal Haemostasis and Bleeding": ["Bleeding or abnormal clotting", "Haemostasis changes"],
  "Dermatological Effects": ["Skin changes", "Rash, irritation, or other skin effects"],
  "Paralytic Neurotoxicity": ["Weakness or paralysis", "Paralytic neurotoxicity"],
  "Effects on Red Blood Cells (potentially including haemolysis)": ["Red blood cell damage", "May include haemolysis"],
  "Myotoxic (local or systemic muscle damage)": ["Muscle pain or damage", "Local or systemic myotoxicity"],
  "Non-specific General System Effects": ["General whole-body symptoms", "Non-specific systemic effects"],
  "Effects on White Blood Cells (notably Leukocytosis and/or Lymphopenia)": ["White blood cell changes", "Leukocytosis or lymphopenia"],
  "Localised Effects at bite/string/contact location": ["Bite, sting, or contact-site effects", "Local effects at the exposure site"],
  "Excitatory Neurotoxicity": ["Agitation, spasms, or overactivity", "Excitatory neurotoxicity"]
};
const diagnosticLinkOptions = diagnosticOptions.map(option => {
  const [label, detail] = diagnosticPresentation[option.label] || [option.label, "Observed clinical effect"];
  return { ...option, label, detail };
});
const countryCodeAliases = {
  "Antigua and Barbuda": "AG", "Bosnia and Herzegovina": "BA", "Cabinda": "AO",
  "Canary Islands ( Spain )": "ES", "Cote d'Ivoire ( Ivory Coast )": "CI",
  "Czechoslavakian Republic": "CZ", "Democratic Republic of Congo": "CD", "England": "GB",
  "Federated States of Micronesia": "FM", "Galapagos Islands ( Ecuador )": "EC", "Macedonia": "MK",
  "Myanmar": "MM", "Republic of Congo": "CG", "Reunion": "RE", "Saint Kitts and Nevis": "KN",
  "Saint Lucia": "LC", "Saint Vincent and the Grenadines": "VC", "Sao Tome and Principe": "ST",
  "South Korea": "KR", "North Korea": "KP", "Trinidad and Tobago": "TT", "Turkey": "TR",
  "United States of America": "US", "Wales": "GB", "West Sahara": "EH", "Yugoslavia": "RS"
};
const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
const regionCodeByName = new Map();
for (let first = 65; first <= 90; first += 1) for (let second = 65; second <= 90; second += 1) {
  const code = String.fromCharCode(first, second);
  const name = regionNames.of(code);
  if (name && name !== code) regionCodeByName.set(name.toLocaleLowerCase(), code);
}
const countryFlag = name => {
  const plainName = name.replace(/\s*\([^)]*\)\s*/g, " ").trim();
  const code = countryCodeAliases[name] || regionCodeByName.get(plainName.toLocaleLowerCase());
  return code ? String.fromCodePoint(...code.split("").map(character => 127397 + character.charCodeAt(0))) : "🏳️";
};
const countryLinkOptions = countryOptions.map(option => ({ ...option, icon: countryFlag(option.label) }));
const speciesOptions = [...new Set(index.flatMap(record => record.species || []))]
  .map(value => ({ value, label: value, count: index.filter(record => record.species.includes(value)).length }))
  .sort((a, b) => a.label.localeCompare(b.label));
const sideFilterLinks = (options, parameter, homeHref) => options.map(option => `<a class="side-filter side-filter-link" href="${escapeHtml(homeHref)}?${parameter}=${encodeURIComponent(option.tag)}"><span class="side-filter-marker" aria-hidden="true"></span><span class="side-filter-label">${option.icon ? `<span class="country-flag" aria-hidden="true">${escapeHtml(option.icon)}</span>` : ""}<span>${escapeHtml(option.label)}</span></span><small>${option.count}</small></a>`).join("");
const diagnosticFilterLinks = (options, homeHref) => options.map(option => `<a class="diagnostic-option diagnostic-option-link" href="${escapeHtml(homeHref)}?diagnostic=${encodeURIComponent(option.tag)}"><span class="side-filter-marker" aria-hidden="true"></span><span class="diagnostic-copy"><strong>${escapeHtml(option.label)}</strong><small>${escapeHtml(option.detail)}</small></span><span class="diagnostic-total">${option.count}</span></a>`).join("");
const speciesSelectOptions = () => speciesOptions.map(option => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)} (${option.count})</option>`).join("");

const shell = ({ title, description, content, bodyClass = "", cssHref = "/assets/site.css", homeHref = "/" }) => `<!doctype html>
<html lang="en-AU">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="theme-color" content="#071813">
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="${cssHref}">
</head>
<body class="${bodyClass}">
  ${content}
</body>
</html>`;

const sidebar = ({ homeHref = "index.html", searchable = false } = {}) => `<aside class="legacy-sidebar">
  <a class="legacy-logo" href="${homeHref}">Toxinology.com <small>BETA</small></a>
  <section class="side-section"><h2>Location</h2><p>Select any countries. No country is selected by default.</p>${searchable ? `<div id="country-filters" class="side-filter-list country-filters"></div>` : `<div class="side-filter-list country-filters">${sideFilterLinks(countryLinkOptions, "country", homeHref)}</div>`}</section>
  <section class="side-section"><h2>Keywords</h2><p>Search by name, taxonomy, content, or keyword.</p>${searchable ? `<form class="search" role="search"><div class="search-box"><input id="query" type="search" list="keyword-options" aria-label="Search names, taxonomy, content, and keywords" autocomplete="off"><datalist id="keyword-options"></datalist><button type="reset" aria-label="Clear search">×</button></div></form>` : `<form class="search" role="search" action="${escapeHtml(homeHref)}"><div class="search-box"><input name="q" type="search" list="record-keyword-options" aria-label="Search names, taxonomy, content, and keywords" autocomplete="off"><datalist id="record-keyword-options">${keywordOptions.map(option => `<option value="${escapeHtml(option.label)}"></option>`).join("")}</datalist><button type="submit" aria-label="Search">›</button></div></form>`}</section>
  <section class="side-section"><h2>Primary Species</h2><p>Filter by a recorded species.</p>${searchable ? `<select id="species-filter" class="side-select" aria-label="Filter by primary species"><option value="">All species</option>${speciesSelectOptions()}</select>` : `<form class="side-select-form" action="${escapeHtml(homeHref)}"><select name="species" class="side-select" aria-label="Filter by primary species" onchange="this.form.submit()"><option value="">All species</option>${speciesSelectOptions()}</select></form>`}</section>
  <section class="side-section diagnostic-section"><h2>Diagnostic Questionnaire</h2><p>Select one or more observed effects.</p><div class="diagnostic-status"><span${searchable ? ` id="diagnostic-selection" aria-live="polite"` : ""}>No effects selected</span>${searchable ? `<button id="clear-diagnostics" type="button" hidden>Clear</button>` : ""}</div>${searchable ? `<div id="diagnostic-filters" class="side-filter-list diagnostic-filters"></div>` : `<div class="side-filter-list diagnostic-filters">${diagnosticFilterLinks(diagnosticLinkOptions, homeHref)}</div>`}<p class="diagnostic-note">This tool narrows catalogue results; it does not provide a diagnosis.</p></section>
  ${searchable ? `<div id="risk-filters" hidden></div>` : ""}
  <p class="medical-note">Information catalogue only. In an emergency, contact local emergency services or a poison information centre.</p>
</aside>`;

const home = shell({
  title: "Toxinology — Australia",
  description: "Search the Australian toxinology catalogue by organism, taxonomy, category and risk.",
  bodyClass: "home",
  content: `<div class="legacy-shell">
    ${sidebar({ searchable: true })}
    <main class="legacy-main">
      <section class="catalogue" aria-label="Catalogue results">
        <header class="results-header"><div><h1><span id="result-count">${index.length}</span> Results</h1><p id="result-label">for all organisms</p></div><div class="results-actions"><label class="column-control">Across <select id="columns" aria-label="Organisms across"><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5" selected>5</option><option value="6">6</option></select></label><button id="reset-filters" class="reset-filters" type="button" disabled>Reset filters</button><div class="view-buttons" aria-label="Display mode"><button type="button" class="selected"><img src="/assets/legacy-icons/icon-grid.svg" alt="Grid"></button><button type="button"><img src="/assets/legacy-icons/icon-list.svg" alt="List"></button></div></div></header>
        <div id="category-filters" class="category-filters"></div>
        <div class="result-toolbar"><label>Sort by <select id="sort" aria-label="Sort results"><option value="relevant">Relevant</option><option value="risk">Risk</option><option value="name">Name</option><option value="taxonomy">Taxonomy</option></select></label><span class="sort-arrow">↓</span></div>
        <div id="results" class="results"></div><p id="empty" class="empty" hidden>No matching records. Try a broader term or clear a filter.</p>
      </section>
    </main>
  </div>
  <script type="application/json" id="catalogue-data">${JSON.stringify(index).replace(/</g, "\\u003c")}</script>
  <script type="module" src="/assets/site.js"></script>`
});
const [publishedCssSource, publishedJsSource] = await Promise.all([
  readFile(path.join(STYLE, "assets", "site.css"), "utf8"),
  readFile(path.join(STYLE, "assets", "site.js"), "utf8")
]);
const publishedCss = publishedCssSource
  .replaceAll('url("legacy-icons/', 'url("/assets/legacy-icons/')
  .replaceAll('url("fonts/', 'url("/assets/fonts/');
const publishedHome = home
  .replace('<link rel="stylesheet" href="/assets/site.css">', `<style>${publishedCss}</style>`)
  .replace('<script type="module" src="/assets/site.js"></script>', `<script>${publishedJsSource.replaceAll("</script", "<\\/script")}</script>`);
await writeFile(path.join(OUTPUT, "index.html"), publishedHome);
await writeFile(path.join(OUTPUT, "search-index.json"), JSON.stringify(index));

function renderRecordBody(body) {
  const sections = [];
  const pattern = /^##\s+(.+)$/gm;
  let match;
  let previous = null;
  while ((match = pattern.exec(body))) {
    if (previous) sections.push({ name: previous.name, content: body.slice(previous.start, match.index).trim() });
    previous = { name: match[1].trim(), start: pattern.lastIndex };
  }
  if (previous) sections.push({ name: previous.name, content: body.slice(previous.start).trim() });
  const sectionOrder = ["Summary", "First Aid", "Diagnosis", "Medical Treatment", "Antivenom", "Clinical Effects", "Description", "Distribution", "Venom", "Case Studies", "References", "Gallery and source captions", "Migration provenance"];
  sections.sort((a, b) => (sectionOrder.indexOf(a.name) < 0 ? sectionOrder.length : sectionOrder.indexOf(a.name)) - (sectionOrder.indexOf(b.name) < 0 ? sectionOrder.length : sectionOrder.indexOf(b.name)));
  return sections.map(({ name, content }) => {
    if (name === "Summary") {
      const facts = [];
      const factPattern = /^###\s+(.+)$/gm;
      let factMatch;
      let priorFact = null;
      while ((factMatch = factPattern.exec(content))) {
        if (priorFact) facts.push({ name: priorFact.name, content: content.slice(priorFact.start, factMatch.index).trim() });
        priorFact = { name: factMatch[1].trim(), start: factPattern.lastIndex };
      }
      if (priorFact) facts.push({ name: priorFact.name, content: content.slice(priorFact.start).trim() });
      facts.sort((a, b) => Number(!/venomous|risk/i.test(a.name)) - Number(!/venomous|risk/i.test(b.name)));
      return `<section class="summary-panel" aria-label="Summary">${facts.map(fact => `<div class="summary-fact ${/venomous|risk/i.test(fact.name) ? "is-risk" : ""}"><h3>${escapeHtml(fact.name)}</h3>${markdownToHtml(fact.content)}</div>`).join("")}</section>`;
    }
    const html = markdownToHtml(content);
    return `<details class="legacy-section"><summary>${escapeHtml(name)}<span aria-hidden="true">⌄</span></summary><div class="section-content">${html}</div></details>`;
  }).join("\n");
}

for (const record of records) {
  const { data, body } = record;
  const directory = path.join(OUTPUT, "record", data.id);
  await mkdir(directory, { recursive: true });
  const sourceImages = path.join(path.dirname(record.file), "_images");
  const imageFiles = (await readdir(sourceImages, { withFileTypes: true }))
    .filter(entry => entry.isFile() && IMAGE_FILE.test(entry.name))
    .map(entry => entry.name)
    .sort((a, b) => Number(path.parse(a).name.toLowerCase() !== "main") - Number(path.parse(b).name.toLowerCase() !== "main") || a.localeCompare(b, undefined, { numeric: true }));
  await cp(sourceImages, path.join(directory, "_images"), { recursive: true, force: true });
  const tags = [data.subject, ...(data.countries || []), data.risk, ...(data.tags || [])].map(value => `<span>${escapeHtml(String(value).replaceAll("-", " "))}</span>`).join("");
  const taxonomy = [["Family", data.family], ["Genus", data.genus], ["Species", data.species], ["Subspecies", data.subspecies]]
    .filter(([, values]) => values?.length)
    .map(([name, values]) => `<div><dt>${name}</dt><dd>${values.map(value => `<span>${escapeHtml(value)}</span>`).join("")}</dd></div>`).join("");
  // Legacy images are retained as provenance metadata, but are not hot-linked:
  // the old host is HTTP-only and would be blocked on the HTTPS production site.
  const gallery = imageFiles.length
    ? `<div class="organism-gallery" aria-label="Images of ${escapeHtml(data.title)}">${imageFiles.map((filename, position) => `<figure><button class="gallery-image" type="button" aria-label="View ${escapeHtml(imageCaption(filename))}"><img src="_images/${escapeHtml(filename)}" alt="${escapeHtml(data.title)} — ${escapeHtml(imageCaption(filename))}" ${position ? 'loading="lazy"' : ""}></button><figcaption>${escapeHtml(imageCaption(filename))}</figcaption></figure>`).join("")}</div>`
    : `<div class="legacy-gallery-placeholder" aria-label="No local images have been added"><span aria-hidden="true"></span></div>`;
  const recordBundle = { ...data, content_markdown: body, source_file: `content/${path.relative(path.join(ROOT, "content"), record.file).replaceAll(path.sep, "/")}` };
  await writeFile(path.join(directory, "record.json"), JSON.stringify(recordBundle, null, 2));
  await mkdir(path.join(directory, "_images"), { recursive: true });
  await writeFile(path.join(directory, "_images", "manifest.json"), JSON.stringify({
    organism: data.id,
    files: imageFiles,
    legacy_sources: data.image_sources || (data.image_source ? [data.image_source] : []),
    note: "Every supported image file in this folder is copied and displayed automatically on the organism page."
  }, null, 2));
  const page = shell({
    title: `${data.title} — Toxinology`,
    description: `${data.title} (${data.scientific_name}), ${data.risk}.`,
    bodyClass: "record-page",
    cssHref: "../../assets/site.css",
    homeHref: "../../../index.html",
    content: `<div class="legacy-shell">${sidebar({ homeHref: "../../index.html" })}<main class="legacy-main"><article class="record"><a class="back-bar" href="../../index.html"><span>‹</span> Back to Results</a><header class="record-header"><div><h1>${escapeHtml(data.title)}${data.aliases?.length ? `, ${data.aliases.map(escapeHtml).join(", ")}` : ""}</h1><p class="scientific">${escapeHtml(data.scientific_name)}</p></div></header>${taxonomy ? `<dl class="taxonomy">${taxonomy}</dl>` : ""}${gallery}<div class="tags record-tags">${tags}</div><div class="record-body">${renderRecordBody(body)}</div><aside class="source"><strong>Provenance</strong><p>Migrated from <a href="${escapeHtml(data.source_url || "#")}">the legacy Toxinology.com application</a> on ${escapeHtml(data.source_accessed || "an unknown date")}. Review status: ${escapeHtml(data.review_status || "not recorded")}.</p></aside></article></main></div>`
  });
  await writeFile(path.join(directory, "index.html"), page);
}

const notFound = shell({ title: "Not found — Toxinology", description: "The requested Toxinology record was not found.", content: `<main class="not-found"><p class="eyebrow">404</p><h1>That record isn’t here.</h1><p>It may have moved or not yet been migrated.</p><a class="button" href="/">Search the catalogue</a></main>` });
await writeFile(path.join(OUTPUT, "404.html"), notFound);
const [standaloneCss, standaloneJs] = await Promise.all([
  readFile(path.join(STYLE, "assets", "site.css"), "utf8"),
  readFile(path.join(STYLE, "assets", "site.js"), "utf8")
]);
const standalone = home
  .replace('<link rel="stylesheet" href="/assets/site.css">', `<style>${standaloneCss}</style>`)
  .replace('<script type="module" src="/assets/site.js"></script>', `<script>${standaloneJs.replaceAll("</script", "<\\/script")}</script>`)
  .replaceAll('src="/assets/legacy-icons/', 'src="./style/assets/legacy-icons/')
  .replaceAll('url("legacy-icons/', 'url("./style/assets/legacy-icons/')
  .replaceAll('url("fonts/', 'url("./style/assets/fonts/')
  .replace('class="brand" href="/"', 'class="brand" href="./index.html"');
await writeFile(path.join(ROOT, "index.html"), standalone);

await rm(PREVIOUS, { recursive: true, force: true });
let movedPublishedSite = false;
try {
  await rename(PUBLISHED, PREVIOUS);
  movedPublishedSite = true;
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
try {
  await rename(OUTPUT, PUBLISHED);
  await rm(PREVIOUS, { recursive: true, force: true });
} catch (error) {
  if (movedPublishedSite) await rename(PREVIOUS, PUBLISHED);
  throw error;
}

console.log(`Built ${records.length} records into ${path.relative(ROOT, PUBLISHED)}/.`);
