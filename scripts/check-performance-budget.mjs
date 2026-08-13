import { readdir, stat } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const output = join(process.cwd(), "dist", "client");
const limits = { ".js": 600 * 1024, ".css": 150 * 1024 };
const totalJsLimit = 2.5 * 1024 * 1024;

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory() ? filesIn(join(directory, entry.name)) : [join(directory, entry.name)],
    ),
  );
  return nested.flat();
}

const files = await filesIn(output);
const measured = await Promise.all(
  files
    .filter((file) => Object.hasOwn(limits, extname(file)))
    .map(async (file) => ({ file, extension: extname(file), bytes: (await stat(file)).size })),
);
const failures = measured.filter(({ extension, bytes }) => bytes > limits[extension]);
const totalJs = measured
  .filter(({ extension }) => extension === ".js")
  .reduce((total, { bytes }) => total + bytes, 0);

if (totalJs > totalJsLimit)
  failures.push({ file: "all JavaScript", bytes: totalJs, extension: ".js" });
for (const failure of failures) {
  console.error(
    `Performance budget exceeded: ${relative(process.cwd(), failure.file)} is ${Math.ceil(failure.bytes / 1024)} KiB`,
  );
}
if (failures.length) process.exit(1);
console.log(
  `Performance budgets passed (${measured.length} assets, ${Math.ceil(totalJs / 1024)} KiB JavaScript).`,
);
