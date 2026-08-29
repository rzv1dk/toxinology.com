const records = JSON.parse(document.querySelector("#catalogue-data").textContent);
const query = document.querySelector("#query");
const resultRoot = document.querySelector("#results");
const count = document.querySelector("#result-count");
const label = document.querySelector("#result-label");
const empty = document.querySelector("#empty");
const sort = document.querySelector("#sort");
const resetFilters = document.querySelector("#reset-filters");
const columns = document.querySelector("#columns");
const speciesFilter = document.querySelector("#species-filter");
const diagnosticSelection = document.querySelector("#diagnostic-selection");
const clearDiagnostics = document.querySelector("#clear-diagnostics");
const state = { categories: new Set(), countries: new Set(), diagnostics: new Set(), risks: new Set() };
const riskOrder = { "High Risk": 0, "Moderate Risk": 1, "Mild Risk": 2, "Low Risk": 3, "No Risk": 4, "Unknown Risk": 5 };
const categoryPrefix = "category:";
const countryPrefix = "country:";
const keywordPrefix = "keyword:";
const diagnosticPrefix = "diagnostic:";
const categoryOrder = ["category:snakes", "category:scorpions", "category:spiders", "category:other-land", "category:other-aquatic"];
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
const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const title = value => value.replaceAll("-", " ").replace(/\b\w/g, char => char.toUpperCase());
const fileMode = location.protocol === "file:";
const inOutput = /\/public\/index\.html$/i.test(location.pathname);
const initialParameters = new URLSearchParams(location.search);

try {
  const savedColumns = localStorage.getItem("toxinology-columns");
  if (["2", "3", "4", "5", "6"].includes(savedColumns)) columns.value = savedColumns;
} catch {}

function applyColumnCount() {
  const minimumCardWidth = 135;
  const gap = 5;
  const maximumThatFits = Math.max(1, Math.floor((resultRoot.clientWidth + gap) / (minimumCardWidth + gap)));
  const effectiveColumns = Math.min(Number(columns.value), maximumThatFits);
  resultRoot.style.setProperty("--grid-columns", effectiveColumns);
  resultRoot.dataset.columns = effectiveColumns;
}

function makeFilters(rootId, values, key, formatter = value => value) {
  const root = document.querySelector(rootId);
  for (const value of values) {
    const amount = records.filter(record => Array.isArray(record[key]) ? record[key].includes(value) : record[key] === value).length;
    const label = document.createElement("label");
    label.className = key === "tags" ? "category-filter" : `${key}-filter`;
    label.innerHTML = `<input type="checkbox" value="${esc(value)}"><span>${esc(formatter(value))}</span><small>${amount}</small>`;
    label.querySelector("input").addEventListener("change", event => {
      const selection = key === "tags" ? state.categories : state[`${key}s`];
      event.target.checked ? selection.add(value) : selection.delete(value);
      render();
    });
    root.append(label);
  }
}

function makeTagFilters(rootId, values, stateKey, className, formatter) {
  const root = document.querySelector(rootId);
  for (const value of values) {
    const amount = records.filter(record => record.tags.includes(value)).length;
    const option = document.createElement("label");
    option.className = className;
    option.innerHTML = `<input type="checkbox" value="${esc(value)}"><span>${esc(formatter(value))}</span><small>${amount}</small>`;
    option.querySelector("input").addEventListener("change", event => {
      event.target.checked ? state[stateKey].add(value) : state[stateKey].delete(value);
      render();
    });
    root.append(option);
  }
}

function makeDiagnosticFilters(values) {
  const root = document.querySelector("#diagnostic-filters");
  for (const value of values) {
    const technicalName = value.slice(diagnosticPrefix.length);
    const [plainName, detail] = diagnosticPresentation[technicalName] || [technicalName, "Observed clinical effect"];
    const amount = records.filter(record => record.tags.includes(value)).length;
    const option = document.createElement("label");
    option.className = "diagnostic-option";
    option.innerHTML = `<input type="checkbox" value="${esc(value)}"><span class="diagnostic-copy"><strong>${esc(plainName)}</strong><small>${esc(detail)}</small></span><span class="diagnostic-total">${amount}</span>`;
    option.querySelector("input").addEventListener("change", event => {
      event.target.checked ? state.diagnostics.add(value) : state.diagnostics.delete(value);
      render();
    });
    root.append(option);
  }
}

const categoryTags = [...new Set(records.flatMap(record => record.tags || []).filter(tag => tag.startsWith(categoryPrefix)))].sort((a, b) => {
  const aPosition = categoryOrder.indexOf(a);
  const bPosition = categoryOrder.indexOf(b);
  return (aPosition < 0 ? categoryOrder.length : aPosition) - (bPosition < 0 ? categoryOrder.length : bPosition) || a.localeCompare(b);
});
makeFilters("#category-filters", categoryTags, "tags", value => title(value.slice(categoryPrefix.length)));
makeFilters("#risk-filters", [...new Set(records.map(r => r.risk))].sort((a,b) => riskOrder[a] - riskOrder[b]), "risk");
const countryTags = [...new Set(records.flatMap(record => record.tags).filter(tag => tag.startsWith(countryPrefix)))].sort((a, b) => a.localeCompare(b));
const diagnosticTags = [...new Set(records.flatMap(record => record.tags).filter(tag => tag.startsWith(diagnosticPrefix)))].sort((a, b) => a.localeCompare(b));
const keywordTags = [...new Set(records.flatMap(record => record.tags).filter(tag => tag.startsWith(keywordPrefix)))].sort((a, b) => a.localeCompare(b));
makeTagFilters("#country-filters", countryTags, "countries", "side-filter", value => value.slice(countryPrefix.length));
makeDiagnosticFilters(diagnosticTags);
document.querySelector("#keyword-options").innerHTML = keywordTags.map(value => `<option value="${esc(value.slice(keywordPrefix.length))}"></option>`).join("");

const initialCountry = initialParameters.get("country");
const initialDiagnostic = initialParameters.get("diagnostic");
const initialSpecies = initialParameters.get("species");
const initialQuery = initialParameters.get("q");
if (initialCountry && countryTags.includes(initialCountry)) {
  state.countries.add(initialCountry);
  const option = [...document.querySelectorAll("#country-filters input")].find(input => input.value === initialCountry);
  if (option) option.checked = true;
}
if (initialDiagnostic && diagnosticTags.includes(initialDiagnostic)) {
  state.diagnostics.add(initialDiagnostic);
  const option = [...document.querySelectorAll("#diagnostic-filters input")].find(input => input.value === initialDiagnostic);
  if (option) option.checked = true;
}
if (initialSpecies && [...speciesFilter.options].some(option => option.value === initialSpecies)) speciesFilter.value = initialSpecies;
if (initialQuery) query.value = initialQuery;

function render() {
  const needle = query.value.trim().toLocaleLowerCase();
  const selectedCategories = state.categories;
  const selectedCountries = state.countries;
  const selectedDiagnostics = state.diagnostics;
  const selectedRisks = state.risks;
  const output = records.filter(record => {
    if (selectedCategories.size && ![...selectedCategories].some(category => record.tags.includes(category))) return false;
    if (selectedCountries.size && ![...selectedCountries].some(country => record.tags.includes(country))) return false;
    if (selectedDiagnostics.size && ![...selectedDiagnostics].every(effect => record.tags.includes(effect))) return false;
    if (speciesFilter.value && !record.species.includes(speciesFilter.value)) return false;
    if (selectedRisks.size && !selectedRisks.has(record.risk)) return false;
    if (!needle) return true;
    const haystack = [record.title, record.scientific_name, record.aliases, record.family, record.genus, record.species, record.subspecies, record.tags, record.topic, record.subject, record.risk, record.countries, record.keywords, record.text].flat().join(" ").toLocaleLowerCase();
    return needle.split(/\s+/).every(word => haystack.includes(word));
  });
  output.sort((a, b) => sort.value === "name" ? a.title.localeCompare(b.title) : sort.value === "taxonomy" ? a.scientific_name.localeCompare(b.scientific_name) : sort.value === "risk" ? (riskOrder[a.risk] - riskOrder[b.risk]) || a.title.localeCompare(b.title) : 0);
  count.textContent = output.length;
  const countryNames = [...selectedCountries].map(value => value.slice(countryPrefix.length));
  label.textContent = output.length === records.length ? "for all organisms" : `for ${output.length} matching organism${output.length === 1 ? "" : "s"}${countryNames.length ? ` in ${countryNames.join(", ")}` : ""}`;
  empty.hidden = output.length > 0;
  diagnosticSelection.textContent = selectedDiagnostics.size ? `${selectedDiagnostics.size} effect${selectedDiagnostics.size === 1 ? "" : "s"} selected` : "No effects selected";
  clearDiagnostics.hidden = selectedDiagnostics.size === 0;
  resetFilters.disabled = !query.value.trim() && !speciesFilter.value && !state.categories.size && !state.countries.size && !state.diagnostics.size && !state.risks.size;
  resultRoot.innerHTML = output.map(record => {
    const href = fileMode ? `${inOutput ? "." : "./public"}${record.href}index.html` : record.href;
    const cardImage = fileMode ? `${inOutput ? "." : "./public"}${record.card_image}` : record.card_image;
    const category = (record.tags.find(tag => tag.startsWith(categoryPrefix)) || "category:other-land").slice(categoryPrefix.length);
    const displayName = record.title.replace(/^\(\s*subsp\.\s*[^)]+\)\s*/i, "").trim() || record.title;
    const subspecies = record.subspecies?.length
      ? record.subspecies.map(value => /^subsp\./i.test(value) ? value : `subsp. ${value}`).join(", ")
      : "—";
    return `<a class="card category-${esc(category)}" href="${href}"><div class="card-visual"><img class="organism-image${record.card_image_is_placeholder ? " is-placeholder" : ""}" src="${esc(cardImage)}" alt="${esc(record.card_image_is_placeholder ? `${record.title} placeholder` : record.title)}" loading="lazy"><span class="risk risk-${esc(record.risk.toLowerCase().replaceAll(" ", "-"))}">${esc(record.risk)}</span></div><div class="card-body"><h2 title="${esc(displayName)}">${esc(displayName)}</h2><p class="subspecies" title="${esc(subspecies)}">${esc(subspecies)}</p><p class="latin" title="${esc(record.scientific_name)}">${esc(record.scientific_name)}</p></div></a>`;
  }).join("");
}

query.addEventListener("input", render);
query.form.addEventListener("reset", () => setTimeout(render));
sort.addEventListener("change", render);
speciesFilter.addEventListener("change", render);
clearDiagnostics.addEventListener("click", () => {
  state.diagnostics.clear();
  for (const input of document.querySelectorAll("#diagnostic-filters input")) input.checked = false;
  render();
});
columns.addEventListener("change", () => {
  try { localStorage.setItem("toxinology-columns", columns.value); } catch {}
  applyColumnCount();
});
window.addEventListener("resize", applyColumnCount);
resetFilters.addEventListener("click", () => {
  query.value = "";
  speciesFilter.value = "";
  for (const selection of [state.categories, state.countries, state.diagnostics, state.risks]) selection.clear();
  for (const input of document.querySelectorAll('input[type="checkbox"]')) input.checked = false;
  if (location.search) history.replaceState(null, "", location.pathname + location.hash);
  render();
});
applyColumnCount();
render();
