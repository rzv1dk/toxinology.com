import { copyFile, mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { ROOT, loadRecords } from "./content.mjs";

const masters = new Map([
  ["snakes", "placeholder-snake.png"],
  ["scorpions", "placeholder-scorpion.png"],
  ["spiders", "placeholder-spider.png"],
  ["other-land", "placeholder-other-land.png"],
  ["other-aquatic", "placeholder-other-aquatic.png"]
]);

let installed = 0;
let replacedLegacySnakeIcons = 0;
for (const record of await loadRecords()) {
  const filename = masters.get(record.data.subject);
  if (!filename) throw new Error(`No placeholder master for subject ${record.data.subject}`);
  const imageDirectory = path.join(path.dirname(record.file), "_images");
  await mkdir(imageDirectory, { recursive: true });
  try {
    await unlink(path.join(imageDirectory, "placeholder-snake.svg"));
    replacedLegacySnakeIcons += 1;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  await copyFile(path.join(ROOT, "style", "assets", "placeholders", filename), path.join(imageDirectory, filename));
  installed += 1;
}

console.log(`Installed category placeholder icons in ${installed} organism folders; replaced ${replacedLegacySnakeIcons} legacy snake SVG placeholders.`);
