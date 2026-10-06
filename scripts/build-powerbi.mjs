import fs from "node:fs/promises";
import path from "node:path";
const root = path.resolve("powerbi");
const report = "AcuityCompass.Report",
  model = "AcuityCompass.SemanticModel";
async function write(name, value) {
  const p = path.join(root, name);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(value, null, 2) + "\n");
}
const schema = (kind, version = "1.0.0") =>
  `https://developer.microsoft.com/json-schemas/fabric/item/report/definition/${kind}/${version}/schema.json`;
await write("AcuityCompass.pbip", {
  $schema:
    "https://developer.microsoft.com/json-schemas/fabric/pbip/pbipProperties/1.0.0/schema.json",
  version: "1.0",
  artifacts: [{ report: { path: report } }],
  settings: { enableAutoRecovery: true },
});
await write(`${report}/definition.pbir`, {
  $schema:
    "https://developer.microsoft.com/json-schemas/fabric/item/report/definitionProperties/2.0.0/schema.json",
  version: "4.0",
  datasetReference: { byPath: { path: `../${model}` } },
});
await write(`${model}/definition.pbism`, {
  $schema:
    "https://developer.microsoft.com/json-schemas/fabric/item/semanticModel/definitionProperties/1.0.0/schema.json",
  version: "1.0",
  settings: { qnaEnabled: false },
});
const field = (table, name, type) => ({
  [type === "measure" ? "Measure" : "Column"]: {
    Expression: { SourceRef: { Entity: table } },
    Property: name,
  },
});
const projection = (table, name, type = "measure", label = name) => ({
  field: field(table, name, type),
  queryRef: `${table}.${name}`,
  nativeQueryRef: name,
  displayName: label,
});
const measures = [
  ["Total arrivals", "SUM(department_hourly[arrivals])", "#,0"],
  ["Total departures", "SUM(department_hourly[departures])", "#,0"],
  [
    "Latest snapshot",
    "MAX(department_hourly[snapshot_time])",
    "dd MMM yyyy HH:mm",
  ],
  [
    "Active patients",
    "VAR S = [Latest snapshot] RETURN IF(ISBLANK(S), BLANK(), CALCULATE(MAX(department_hourly[active_patients]), department_hourly[snapshot_time] = S))",
    "#,0",
  ],
  [
    "Patients waiting",
    "VAR S = [Latest snapshot] RETURN IF(ISBLANK(S), BLANK(), CALCULATE(MAX(department_hourly[patients_waiting]), department_hourly[snapshot_time] = S))",
    "#,0",
  ],
  [
    "Bed occupancy",
    "VAR S = [Latest snapshot] VAR O = CALCULATE(MAX(department_hourly[occupied_beds]), department_hourly[snapshot_time] = S) VAR C = CALCULATE(MAX(department_hourly[staffed_beds]), department_hourly[snapshot_time] = S) RETURN IF(ISBLANK(S), BLANK(), DIVIDE(O,C))",
    "0.00%",
  ],
  [
    "Area bed occupancy",
    "VAR S = [Latest snapshot] VAR O = CALCULATE(SUM(area_capacity_hourly[occupied]), area_capacity_hourly[snapshot_time] = S, area_capacity_hourly[is_bed_area] = 1) VAR C = CALCULATE(SUM(area_capacity_hourly[staffed_capacity]), area_capacity_hourly[snapshot_time] = S, area_capacity_hourly[is_bed_area] = 1) RETURN IF(ISBLANK(S), BLANK(), DIVIDE(O,C))",
    "0.0%",
  ],
  ["Visit count", "COUNTROWS(visits)", "#,0"],
  [
    "Current queue average wait",
    "VAR S = [Latest snapshot] RETURN IF(ISBLANK(S), BLANK(), CALCULATE(MAX(department_hourly[average_elapsed_wait_minutes]), department_hourly[snapshot_time] = S))",
    '0.0 "min"',
  ],
  [
    "Average wait to assessment",
    "AVERAGE(visits[wait_to_assessment_minutes])",
    '0.0 "min"',
  ],
  [
    "Snapshot label",
    'IF(ISBLANK([Latest snapshot]), "No records loaded", "Snapshot: " & FORMAT([Latest snapshot], "dd MMM yyyy HH:mm") & " IST | Historical synthetic data")',
    null,
  ],
];
const definitions = {
  dates: {
    sql: "SELECT report_date FROM public.dates",
    columns: { report_date: "dateTime" },
  },
  areas: {
    sql: "SELECT area_id, area_name, is_bed_area FROM public.areas",
    columns: { area_id: "string", area_name: "string", is_bed_area: "int64" },
  },
  department_hourly: {
    sql: "SELECT hour_start AT TIME ZONE 'Asia/Kolkata' AS hour_start, snapshot_time AT TIME ZONE 'Asia/Kolkata' AS snapshot_time, report_date, arrivals, departures, active_patients, patients_waiting, average_elapsed_wait_minutes, occupied_beds, staffed_beds FROM reporting.department_hourly",
    columns: {
      hour_start: "dateTime",
      snapshot_time: "dateTime",
      report_date: "dateTime",
      arrivals: "int64",
      departures: "int64",
      active_patients: "int64",
      patients_waiting: "int64",
      average_elapsed_wait_minutes: "double",
      occupied_beds: "int64",
      staffed_beds: "int64",
    },
  },
  area_capacity_hourly: {
    sql: "SELECT snapshot_time AT TIME ZONE 'Asia/Kolkata' AS snapshot_time, report_date, area_id, occupied, staffed_capacity, is_bed_area FROM reporting.area_capacity_hourly",
    columns: {
      snapshot_time: "dateTime",
      report_date: "dateTime",
      area_id: "string",
      occupied: "int64",
      staffed_capacity: "int64",
      is_bed_area: "int64",
    },
  },
  visits: {
    sql: "SELECT visit_id, arrival_date, triage_level, wait_to_assessment_minutes, CASE triage_level WHEN 'Red' THEN 1 WHEN 'Orange' THEN 2 WHEN 'Yellow' THEN 3 WHEN 'Green' THEN 4 ELSE 5 END AS triage_order FROM public.visits",
    columns: {
      visit_id: "string",
      arrival_date: "dateTime",
      triage_level: "string",
      wait_to_assessment_minutes: "double",
      triage_order: "int64",
    },
  },
};
const tables = Object.entries(definitions).map(([name, d]) => ({
  name,
  columns: Object.entries(d.columns).map(([n, t]) => ({
    name: n,
    dataType: t,
    sourceColumn: n,
    summarizeBy: "none",
    ...(t === "dateTime"
      ? {
          formatString:
            n.includes("time") || n === "hour_start"
              ? "dd MMM yyyy HH:mm"
              : "dd MMM yyyy",
        }
      : {}),
    ...(n === "triage_level" ? { sortByColumn: "triage_order" } : {}),
    ...(n === "triage_order" ? { isHidden: true } : {}),
  })),
  partitions: [
    {
      name,
      mode: "import",
      source: {
        type: "m",
        expression: [
          "let",
          `    Source = PostgreSQL.Database("127.0.0.1:5433", "acuitycompass", [Query="${d.sql}", CreateNavigationProperties=false]),`,
          `    Typed = Table.TransformColumnTypes(Source, {${Object.entries(
            d.columns,
          )
            .map(
              ([n, t]) =>
                `{"${n}", ${t === "dateTime" ? (n.includes("time") || n === "hour_start" ? "type datetime" : "type date") : t === "int64" ? "Int64.Type" : t === "double" ? "type number" : "type text"}}`,
            )
            .join(", ")}})`,
          "in",
          "    Typed",
        ],
      },
    },
  ],
  ...(name === "department_hourly"
    ? {
        measures: measures.map(([name, expression, formatString]) => ({
          name,
          expression,
          ...(formatString ? { formatString } : {}),
          displayFolder: "Dashboard metrics",
        })),
      }
    : {}),
}));
const relationships = [
  ["department_hourly", "report_date", "dates", "report_date"],
  ["area_capacity_hourly", "report_date", "dates", "report_date"],
  ["visits", "arrival_date", "dates", "report_date"],
  ["area_capacity_hourly", "area_id", "areas", "area_id"],
].map(([fromTable, fromColumn, toTable, toColumn], i) => ({
  name: `relationship_${i + 1}`,
  fromTable,
  fromColumn,
  toTable,
  toColumn,
  fromCardinality: "many",
  toCardinality: "one",
  crossFilteringBehavior: "oneDirection",
  isActive: true,
}));
await write(`${model}/model.bim`, {
  name: "AcuityCompass",
  compatibilityLevel: 1567,
  model: {
    culture: "en-GB",
    defaultPowerBIDataSourceVersion: "powerBI_V3",
    sourceQueryCulture: "en-GB",
    dataAccessOptions: { legacyRedirects: true, returnErrorValuesAsNull: true },
    tables,
    relationships,
    annotations: [{ name: "__PBI_TimeIntelligenceEnabled", value: "0" }],
  },
});
await write(`${report}/definition/version.json`, {
  $schema: schema("versionMetadata"),
  version: "2.0.0",
});
await write(`${report}/definition/report.json`, {
  $schema: schema("report"),
  themeCollection: {},
  layoutOptimization: "None",
});
await write(`${report}/definition/pages/pages.json`, {
  $schema: schema("pagesMetadata"),
  pageOrder: ["overview"],
  activePageName: "overview",
});
const lit = (value) => ({
  expr: {
    Literal: {
      Value:
        typeof value === "string"
          ? `'${value.replaceAll("'", "''")}'`
          : String(value),
    },
  },
});
const color = (c) => ({ solid: { color: lit(c) } });
const format = (properties) => [{ properties }];
const visuals = [];
function visual(
  name,
  type,
  title,
  x,
  y,
  width,
  height,
  roles = {},
  objects = {},
) {
  const v = {
    $schema: schema("visualContainer", "2.1.0"),
    name,
    position: {
      x,
      y,
      z: visuals.length,
      tabOrder: visuals.length,
      width,
      height,
    },
    visual: {
      visualType: type,
      query: {
        queryState: Object.fromEntries(
          Object.entries(roles).map(([k, v]) => [k, { projections: v }]),
        ),
      },
      objects,
      visualContainerObjects: {
        title: format({
          show: lit(true),
          text: lit(title),
          fontColor: color("#203149"),
          fontSize: lit(12),
          bold: lit(true),
        }),
        background: format({
          show: lit(true),
          color: color("#FFFFFF"),
          transparency: lit(0),
        }),
        border: format({
          show: lit(true),
          color: color("#E2E8F0"),
          radius: lit(10),
        }),
        visualHeader: format({ show: lit(false) }),
      },
      drillFilterOtherVisuals: true,
    },
  };
  visuals.push(v);
  return v;
}
function text(name, content, x, y, w, h, size = 12, colorHex = "#6A7990") {
  const v = visual(
    name,
    "textbox",
    "",
    x,
    y,
    w,
    h,
    {},
    {
      general: format({
        paragraphs: [
          {
            textRuns: [
              {
                value: content,
                textStyle: {
                  fontFamily: "Segoe UI",
                  fontSize: `${size}pt`,
                  color: colorHex,
                },
              },
            ],
          },
        ],
      }),
    },
  );
  delete v.visual.query;
  v.visual.visualContainerObjects = {
    title: format({ show: lit(false) }),
    background: format({ show: lit(false) }),
  };
  return v;
}
text(
  "title",
  "AcuityCompass | ED activity overview",
  24,
  20,
  780,
  48,
  25,
  "#203149",
);
text(
  "subtitle",
  "SYNTHETIC DATA  •  29 AUG – 27 SEP 2026  •  ASIA/KOLKATA",
  24,
  75,
  780,
  35,
  10,
);
visual(
  "date_range",
  "slicer",
  "Reporting dates",
  880,
  20,
  376,
  105,
  { Values: [projection("dates", "report_date", "column", "Date")] },
  { data: format({ mode: lit("Between") }) },
);
const metrics = [
  "Total arrivals",
  "Active patients",
  "Patients waiting",
  "Bed occupancy",
];
metrics.forEach((m, i) =>
  visual(
    `kpi_${i + 1}`,
    "card",
    i === 0 ? "Arrivals in selected period" : `${m} · latest snapshot`,
    24 + i * 312,
    145,
    296,
    130,
    { Values: [projection("department_hourly", m)] },
    {
      labels: format({
        color: color("#203149"),
        fontSize: lit(32),
        labelDisplayUnits: lit(1),
      }),
      categoryLabels: format({ show: lit(false) }),
    },
  ),
);
visual(
  "arrivals_departures",
  "lineChart",
  "Daily arrivals and departures",
  24,
  295,
  756,
  390,
  {
    Category: [projection("dates", "report_date", "column", "Reporting date")],
    Y: [
      projection("department_hourly", "Total arrivals"),
      projection("department_hourly", "Total departures"),
    ],
  },
  {
    legend: format({ show: lit(true), position: lit("Top") }),
    categoryAxis: format({ show: lit(true) }),
    valueAxis: format({ show: lit(true) }),
    dataPoint: format({ defaultColor: color("#3779E4") }),
  },
);
visual(
  "area_capacity",
  "barChart",
  "Bed occupancy by area · latest snapshot",
  804,
  295,
  452,
  185,
  {
    Category: [projection("areas", "area_name", "column", "Area")],
    Y: [projection("department_hourly", "Area bed occupancy")],
  },
  {
    dataPoint: format({ defaultColor: color("#578BE1") }),
    labels: format({ show: lit(true) }),
    valueAxis: format({ start: lit(0), end: lit(1) }),
  },
);
visual(
  "urgency",
  "barChart",
  "Urgency of arrivals · selected period",
  804,
  500,
  452,
  185,
  {
    Category: [projection("visits", "triage_level", "column", "Urgency")],
    Y: [projection("department_hourly", "Visit count")],
  },
  {
    dataPoint: format({ defaultColor: color("#47A28E") }),
    labels: format({ show: lit(true) }),
  },
);
visual(
  "snapshot",
  "card",
  "",
  24,
  709,
  1232,
  65,
  { Values: [projection("department_hourly", "Snapshot label")] },
  {
    labels: format({ color: color("#6A7990"), fontSize: lit(12) }),
    categoryLabels: format({ show: lit(false) }),
  },
).visual.visualContainerObjects.title = format({ show: lit(false) });
text(
  "footer",
  "Date selection updates the whole report. Counts are period totals; occupancy and queue cards show the latest selected snapshot.",
  24,
  794,
  1232,
  32,
  10,
);
const interactions = [];
for (const source of ["arrivals_departures", "area_capacity", "urgency"])
  for (const target of visuals.filter((v) => v.visual.query))
    if (target.name !== source)
      interactions.push({ source, target: target.name, type: "NoFilter" });
await write(`${report}/definition/pages/overview/page.json`, {
  $schema: schema("page"),
  name: "overview",
  displayName: "ED overview",
  displayOption: "FitToPage",
  height: 850,
  width: 1280,
  objects: {
    background: format({ color: color("#F4F6FA"), transparency: lit(0) }),
  },
  visualInteractions: interactions,
});
for (const v of visuals)
  await write(
    `${report}/definition/pages/overview/visuals/${v.name}/visual.json`,
    v,
  );
console.log(
  `Created ${visuals.length} visuals, ${tables.length} tables and ${measures.length} measures in powerbi/.`,
);
