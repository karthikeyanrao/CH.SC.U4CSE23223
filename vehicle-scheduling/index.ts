import { Log } from '../logging_middleware/index';

interface VehicleTask {
  TaskID: string;
  Duration: number;
  Impact: number;
}

interface Depot {
  ID: number;
  MechanicHours: number;
}

const PACKAGE = 'vehicle-scheduling';
const DEPOT_API   = 'http://20.207.122.201/evaluation-service/depots';
const VEHICLE_API = 'http://20.207.122.201/evaluation-service/vehicles';
function getOptimalSchedule(tasks: VehicleTask[], budget: number) {
  const dp = new Array(budget + 1).fill(0);
  const selected = Array.from({ length: budget + 1 }, () => [] as string[]);

  for (const task of tasks) {
    for (let w = budget; w >= task.Duration; w--) {
      if (dp[w - task.Duration] + task.Impact > dp[w]) {
        dp[w] = dp[w - task.Duration] + task.Impact;
        selected[w] = [...selected[w - task.Duration], task.TaskID];
      }
    }
  }

  return {
    totalImpact: dp[budget],
    vehicleIds: selected[budget]
  };
}

async function runVMS() {

  const authToken = 'Bearer ' + (process.env.AUTH_TOKEN || '');

  await Log('backend', 'info', PACKAGE, 'Initializing Vehicle Maintenance Scheduler...');

  try {
    await Log('backend', 'info', PACKAGE, `Fetching depots from ${DEPOT_API}`);
    const depotRes = await fetch(DEPOT_API, { headers: { 'Authorization': authToken } });
    const { depots }: { depots: Depot[] } = await depotRes.json();
    await Log('backend', 'info', PACKAGE, `Loaded ${depots.length} depots`);

    await Log('backend', 'info', PACKAGE, `Fetching vehicle tasks from ${VEHICLE_API}`);
    const vehicleRes = await fetch(VEHICLE_API, { headers: { 'Authorization': authToken } });
    const { vehicles }: { vehicles: VehicleTask[] } = await vehicleRes.json();
    await Log('backend', 'info', PACKAGE, `Loaded ${vehicles.length} vehicle tasks`);

    for (const depot of depots) {
      const startTime = Date.now();
      const result = getOptimalSchedule(vehicles, depot.MechanicHours);
      const duration = Date.now() - startTime;

      await Log('backend', 'info', PACKAGE,
        `Depot ${depot.ID}: MaxImpact=${result.totalImpact}, Selected=${result.vehicleIds.length} tasks, Time=${duration}ms`);

      console.log(`\n--- Depot ${depot.ID} (Budget: ${depot.MechanicHours}h) ---`);
      console.log(`Max Impact Score: ${result.totalImpact}`);
      console.log(`Selected Vehicle IDs: ${result.vehicleIds.join(', ')}`);
      console.log(`Computation Time: ${duration}ms`);
    }

    await Log('backend', 'info', PACKAGE, 'Scheduler complete');

  } catch (err: any) {
    await Log('backend', 'error', PACKAGE, `Execution failed: ${err.message}`);
  }
}

if (require.main === module) {
  runVMS();
}
