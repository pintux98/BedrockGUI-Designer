import fs from "node:fs/promises";

const OLDEST = process.argv[2] ?? "1.20.6";
const NEWEST = process.argv[3];
const base = "https://raw.githubusercontent.com/misode/mcmeta";

async function json(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

const newest = NEWEST ?? (await json(`${base}/summary/versions/data.json`)).find((v) => v.stable).id;
const load = (v) =>
  Promise.all([json(`${base}/${v}-summary/sounds/data.json`), json(`${base}/${v}-summary/registries/data.json`)]);
const [[newSounds, newReg], [oldSounds, oldReg]] = await Promise.all([load(newest), load(OLDEST)]);

const sounds = [...new Set([...Object.keys(newSounds), ...Object.keys(oldSounds)])].sort();
const items = [...new Set([...newReg.item, ...oldReg.item])].filter((i) => i !== "air").sort();

await fs.writeFile(
  new URL("../src/data/minecraft.ts", import.meta.url),
  `export const MINECRAFT_DATA_RANGE = ${JSON.stringify(`${OLDEST} to ${newest}`)};\n\n` +
    `export const SOUNDS: string[] = ${JSON.stringify(sounds.join(" "))}.split(" ");\n\n` +
    `export const ITEMS: string[] = ${JSON.stringify(items.join(" "))}.split(" ");\n`
);
console.log(`${sounds.length} sounds, ${items.length} items, ${OLDEST} to ${newest}`);
