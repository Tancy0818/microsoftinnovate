import fs from "node:fs/promises";
const modelPath = "powerbi/AcuityCompass.SemanticModel/model.bim";
const root = "powerbi/AcuityCompass.Report/definition/pages/overview";
const read = async (p) => JSON.parse(await fs.readFile(p, "utf8"));
const write = async (p, v) => {
  await fs.mkdir(p.substring(0, p.lastIndexOf("/")), { recursive: true });
  await fs.writeFile(p, JSON.stringify(v, null, 2) + "\n");
};
const model = await read(modelPath);
const columns = {
  id: "string",
  created_at: "dateTime",
  status: "string",
  selected: "string",
  started_at: "dateTime",
  completed_at: "dateTime",
  starting_queue: "int64",
  expected_arrivals: "double",
  observed_queue: "int64",
  observed_active: "int64",
  elapsed_minutes: "double",
  coordinator_note: "string",
  predicted_queue: "double",
  demand_model: "string",
  demand_test_mae: "double",
  baseline_test_mae: "double",
};
const measures = [
  [
    "Recorded choices",
    "CALCULATE(COUNTROWS(planner_outcomes), planner_outcomes[selected] <> BLANK())",
  ],
  [
    "Completed observations",
    'CALCULATE(COUNTROWS(planner_outcomes), planner_outcomes[status] = "completed")',
  ],
  ["Comparisons", "COUNTROWS(planner_outcomes)"],
];
model.model.tables = model.model.tables.filter(
  (t) => t.name !== "planner_outcomes",
);
model.model.tables.push({
  name: "planner_outcomes",
  columns: Object.entries(columns).map(([name, dataType]) => ({
    name,
    dataType,
    sourceColumn: name,
    summarizeBy: "none",
  })),
  partitions: [
    {
      name: "planner_outcomes",
      mode: "import",
      source: {
        type: "m",
        expression: [
          "let",
          ' Source = PostgreSQL.Database("127.0.0.1:5433", "acuitycompass", [CreateNavigationProperties=false]),',
          ' Data = Source{[Schema="reporting",Item="planner_outcomes"]}[Data]',
          "in",
          " Data",
        ],
      },
    },
  ],
  measures: measures.map(([name, expression]) => ({
    name,
    expression,
    formatString: "#,0",
  })),
});
await write(modelPath, model);
const page = await read(`${root}/page.json`);
page.height = 1180;
const projection = (property, measure = true) => ({
  field: {
    [measure ? "Measure" : "Column"]: {
      Expression: { SourceRef: { Entity: "planner_outcomes" } },
      Property: property,
    },
  },
  queryRef: `planner_outcomes.${property}`,
  nativeQueryRef: property,
  ...(!measure ? { active: true } : {}),
});
for (const [i, measure] of [
  "Recorded choices",
  "Completed observations",
].entries()) {
  const visual = await read(`${root}/visuals/kpi_1/visual.json`);
  visual.name = `planner_${i}`;
  visual.position = {
    x: 24 + i * 270,
    y: 890,
    width: 250,
    height: 150,
    z: 1,
    tabOrder: 20 + i,
  };
  visual.visual.query = {
    queryState: { Values: { projections: [projection(measure)] } },
  };
  visual.visual.visualContainerObjects.title[0].properties.text = {
    expr: { Literal: { Value: `'${measure}'` } },
  };
  await write(`${root}/visuals/${visual.name}/visual.json`, visual);
}
const chart = await read(`${root}/visuals/area_capacity/visual.json`);
chart.name = "planner_status";
chart.position = {
  x: 580,
  y: 890,
  width: 675,
  height: 230,
  z: 1,
  tabOrder: 22,
};
chart.visual.query = {
  queryState: {
    Category: { projections: [projection("status", false)] },
    Y: { projections: [projection("Comparisons")] },
  },
};
chart.visual.visualContainerObjects.title[0].properties.text = {
  expr: { Literal: { Value: "'Operational comparisons by status'" } },
};
await write(`${root}/visuals/planner_status/visual.json`, chart);
const caption = await read(`${root}/visuals/footer/visual.json`);
caption.name = "planner_caption";
caption.position = {
  x: 24,
  y: 840,
  width: 1232,
  height: 45,
  z: 1,
  tabOrder: 19,
};
caption.visual.objects.general[0].properties.paragraphs[0].textRuns[0].value =
  "PLANNING OUTCOMES | Synthetic scenarios · observations do not establish causation · Refresh after website changes";
await write(`${root}/visuals/planner_caption/visual.json`, caption);
await write(`${root}/page.json`, page);
console.log(
  "Planner table and outcome visuals added to the existing Power BI report page.",
);
