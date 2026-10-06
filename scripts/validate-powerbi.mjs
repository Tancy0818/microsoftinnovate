import fs from "node:fs/promises";
import path from "node:path";
import Ajv from "ajv";
const ajv = new Ajv({
  strict: false,
  allErrors: true,
  validateFormats: false,
  loadSchema: async (uri) => {
    const response = await fetch(uri);
    if (!response.ok) throw new Error(`Schema ${uri}: ${response.status}`);
    return response.json();
  },
});
async function files(dir) {
  let results = [];
  for (const item of await fs.readdir(dir, { withFileTypes: true })) {
    if (item.name.startsWith(".")) continue; // Desktop caches/settings are not report definitions.
    const p = path.join(dir, item.name);
    results.push(...(item.isDirectory() ? await files(p) : [p]));
  }
  return results;
}
let checked = 0;
const model = JSON.parse(
  await fs.readFile("powerbi/AcuityCompass.SemanticModel/model.bim", "utf8"),
);
function validateReferences(value) {
  if (!value || typeof value !== "object") return;
  for (const kind of ["Measure", "Column"]) {
    const ref = value[kind];
    if (ref?.Expression?.SourceRef?.Entity && ref.Property) {
      const table = model.model.tables.find(
        (t) => t.name === ref.Expression.SourceRef.Entity,
      );
      if (
        !(table?.[kind === "Measure" ? "measures" : "columns"] ?? []).some(
          (p) => p.name === ref.Property,
        )
      )
        throw new Error(
          `Unresolved ${kind}: ${ref.Expression.SourceRef.Entity}.${ref.Property}`,
        );
    }
  }
  for (const child of Object.values(value)) validateReferences(child);
}
for (const p of await files("powerbi")) {
  if (!/\.(json|pbip|pbir|pbism)$/.test(p)) continue;
  const value = JSON.parse(await fs.readFile(p, "utf8"));
  validateReferences(value);
  if (!value.$schema) continue;
  const validate = await ajv.compileAsync({ $ref: value.$schema });
  if (!validate(value)) {
    console.error(p, JSON.stringify(validate.errors, null, 2));
    process.exitCode = 1;
  } else checked++;
}
console.log(
  `${checked} Power BI definition files passed Microsoft JSON schemas.`,
);
