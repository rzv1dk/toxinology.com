import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export const ROOT = path.resolve(import.meta.dirname, "..");
export const CONTENT_DIR = path.join(ROOT, "content");

export function slugify(value) {
  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "record";
}

function scalar(value) {
  const input = value.trim();
  if (input === "") return "";
  if (input === "true") return true;
  if (input === "false") return false;
  if (input === "null") return null;
  if (/^-?\d+(\.\d+)?$/.test(input)) return Number(input);
  if (input.startsWith("[") || input.startsWith("{")) {
    try { return JSON.parse(input); } catch { return input; }
  }
  if ((input.startsWith('"') && input.endsWith('"')) ||
      (input.startsWith("'") && input.endsWith("'"))) {
    try { return JSON.parse(input); } catch { return input.slice(1, -1); }
  }
  return input;
}

export function parseMarkdown(raw, file) {
  if (!raw.startsWith("---\n")) throw new Error(`${file}: missing YAML front matter`);
  const end = raw.indexOf("\n---\n", 4);
  if (end < 0) throw new Error(`${file}: unclosed YAML front matter`);
  const data = {};
  for (const [index, line] of raw.slice(4, end).split("\n").entries()) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!match) throw new Error(`${file}:${index + 2}: unsupported YAML syntax`);
    data[match[1]] = scalar(match[2]);
  }
  return { data, body: raw.slice(end + 5).trim(), file };
}

async function walk(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith("_")) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await walk(target));
    else if (entry.isFile() && entry.name.endsWith(".md")) output.push(target);
  }
  return output;
}

export async function loadRecords() {
  const files = await walk(CONTENT_DIR);
  return Promise.all(files.map(async file => parseMarkdown(await readFile(file, "utf8"), file)));
}

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

export function markdownToHtml(markdown) {
  const lines = markdown.replace(/\r/g, "").split("\n");
  const output = [];
  let paragraph = [];
  let list = null;
  const inline = text => escapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" rel="noopener noreferrer">$1</a>');
  const flushParagraph = () => {
    if (paragraph.length) output.push(`<p>${inline(paragraph.join(" "))}</p>`);
    paragraph = [];
  };
  const closeList = () => { if (list) output.push(`</${list}>`); list = null; };
  for (const line of lines) {
    const heading = /^(#{1,4})\s+(.+)$/.exec(line);
    const bullet = /^\s*[-*]\s+(.+)$/.exec(line);
    const numbered = /^\s*\d+\.\s+(.+)$/.exec(line);
    if (heading) {
      flushParagraph(); closeList();
      const level = heading[1].length;
      output.push(`<h${level} id="${slugify(heading[2])}">${inline(heading[2])}</h${level}>`);
    } else if (bullet || numbered) {
      flushParagraph();
      const next = bullet ? "ul" : "ol";
      if (list !== next) { closeList(); list = next; output.push(`<${list}>`); }
      output.push(`<li>${inline((bullet || numbered)[1])}</li>`);
    } else if (!line.trim()) {
      flushParagraph(); closeList();
    } else {
      paragraph.push(line.trim());
    }
  }
  flushParagraph(); closeList();
  return output.join("\n");
}
