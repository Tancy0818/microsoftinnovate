import { createPool } from "./db.ts";
import { createApi } from "./app.ts";
const pool = createPool();
const server = createApi(pool);
const port = Number(process.env.API_PORT || 3001);
server.listen(port, "127.0.0.1", () =>
  console.log(`AcuityCompass API: http://127.0.0.1:${port}`),
);
server.on("error", (e) => {
  console.error(e.message);
  process.exitCode = 1;
  void pool.end();
});
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => server.close(() => void pool.end()));
