const http = require("http");

const LOG_PATH     = "/evaluation-service/logs";
const DEPOT_PATH   = "/evaluation-service/depots";
const VEHICLE_PATH = "/evaluation-service/vehicles";
let AUTH_TOKEN = process.env.AUTH_TOKEN || "";
function httpRequest(method, path, headers, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: "20.207.122.201",
      port: 80,
      path: path,
      method: method,
      headers: headers,
      timeout: 30000
    };

    const req = http.request(opts, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on("error", (e) => reject(e));
    req.on("timeout", () => { req.destroy(); reject(new Error("Request timed out")); });

    if (body) req.write(body);
    req.end();
  });
}
async function Log(stack, level, packageName, message) {
  stack = stack.toLowerCase();
  level = level.toLowerCase();
  packageName = packageName.toLowerCase();

  const payload = JSON.stringify({
    stack: stack,
    level: level,
    packageName: packageName,
    message: message,
    timestamp: new Date().toISOString()
  });

  console.log(`[${new Date().toISOString()}] [${level}] [${packageName}]: ${message}`);

  if (AUTH_TOKEN) {
    try {
      await httpRequest("POST", LOG_PATH, {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + AUTH_TOKEN
      }, payload);
    } catch (e) {
     
    }
  }
}
function knapsack(tasks, budget) {
  const dp = new Array(budget + 1).fill(0);
  const selected = Array.from({ length: budget + 1 }, () => []);

  for (const task of tasks) {
    const dur = task.duration;
    const imp = task.impact;
    const id  = task.id;
    for (let w = budget; w >= dur; w--) {
      if (dp[w - dur] + imp > dp[w]) {
        dp[w] = dp[w - dur] + imp;
        selected[w] = [...selected[w - dur], id];
      }
    }
  }

  return {
    maxImpact: dp[budget],
    selectedIds: selected[budget]
  };
}

async function main() {
  if (!AUTH_TOKEN) {
    console.error("ERROR: No auth token provided. Run with: AUTH_TOKEN=<token> node scheduler.js");
    return;
  }

  await Log("backend", "info", "vehicle-scheduler", "=== Vehicle Maintenance Scheduler Starting ===");
 await Log("backend", "info", "vehicle-scheduler", "Fetching depot data");
  const depotRes = await httpRequest("GET", DEPOT_PATH, { "Authorization": "Bearer " + AUTH_TOKEN }, null);
  if (depotRes.status !== 200) {
    await Log("backend", "error", "vehicle-scheduler", "Failed to fetch depots: HTTP " + depotRes.status);
    return;
  }
  const depots = depotRes.data.depots || [];
  await Log("backend", "info", "vehicle-scheduler", `Loaded ${depots.length} depots`);
  await Log("backend", "info", "vehicle-scheduler", "Fetching vehicle task data");
  const vehicleRes = await httpRequest("GET", VEHICLE_PATH, { "Authorization": "Bearer " + AUTH_TOKEN }, null);
  if (vehicleRes.status !== 200) {
    await Log("backend", "error", "vehicle-scheduler", "Failed to fetch vehicles: HTTP " + vehicleRes.status);
    return;
  }
  const rawVehicles = vehicleRes.data.vehicles || [];
  await Log("backend", "info", "vehicle-scheduler", `Loaded ${rawVehicles.length} vehicle tasks`);
 const tasks = rawVehicles.map((v) => ({
    id: String(v.TaskID),
    duration: Number(v.Duration),
    impact: Number(v.Impact)
  }));

  if (tasks.length > 0) {
    await Log("backend", "info", "vehicle-scheduler",
      `Sample task: id=${tasks[0].id}, duration=${tasks[0].duration}h, impact=${tasks[0].impact}`);
  }
 console.log("\n" + "=".repeat(60));
  console.log("   VEHICLE MAINTENANCE SCHEDULER — OPTIMAL RESULTS");
  console.log("=".repeat(60));

  for (const depot of depots) {
    const depotId = depot.ID;
    const budget  = depot.MechanicHours;

    await Log("backend", "info", "vehicle-scheduler",
      `Running 0/1 Knapsack for Depot ${depotId} (Budget: ${budget}h)`);

    const startTime = Date.now();
    const result = knapsack(tasks, budget);
    const elapsed = Date.now() - startTime;

    await Log("backend", "info", "vehicle-scheduler",
      `Depot ${depotId}: MaxImpact=${result.maxImpact}, Selected=${result.selectedIds.length} tasks, Time=${elapsed}ms`);

    console.log(`\n┌─ Depot ${depotId} ${"─".repeat(40)}`);
    console.log(`│  Mechanic-Hour Budget : ${budget}h`);
    console.log(`│  Max Impact Score     : ${result.maxImpact}`);
    console.log(`│  Tasks Selected       : ${result.selectedIds.length}`);
    console.log(`│  Selected Vehicle IDs : ${result.selectedIds.join(", ")}`);
    console.log(`│  Computation Time     : ${elapsed}ms`);
    console.log(`└${"─".repeat(50)}`);
  }

  console.log("\n" + "=".repeat(60));
  await Log("backend", "info", "vehicle-scheduler", "=== Scheduler Complete ===");
}

main();
