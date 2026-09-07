import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const destination = process.argv[2] ?? "/tmp/udyaan-tree-source";
const response = await fetch("https://api.polyhaven.com/files/island_tree_02");
if (!response.ok) throw new Error(`Asset metadata failed: ${response.status}`);
const files = await response.json();
const asset = files.gltf["1k"].gltf;
const downloads = [["tree.gltf", { url: asset.url }], ...Object.entries(asset.include)];
for (const [name, entry] of downloads) {
  const file = join(destination, name);
  await mkdir(dirname(file), { recursive: true });
  const download = await fetch(entry.url);
  if (!download.ok) throw new Error(`Asset download failed: ${entry.url} (${download.status})`);
  const bytes = new Uint8Array(await download.arrayBuffer());
  await writeFile(file, bytes);
  console.log(`${name}: ${(bytes.byteLength / 1024).toFixed(0)} KB`);
}