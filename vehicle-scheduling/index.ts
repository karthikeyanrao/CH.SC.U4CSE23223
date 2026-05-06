import { Log } from '../logging middleware/index';

interface VehicleTask {
  taskId: string;
  duration: number;
  impact: number;
}

interface Depot {
  depotId: string;
  mechanicHours: number;
}

const PACKAGE = 'vehicle-scheduling';

function getOptimalSchedule(tasks: VehicleTask[], budget: number) {
  const dp = new Array(budget + 1).fill(0);
  const selected = Array.from({ length: budget + 1 }, () => [] as string[]);

  for (const task of tasks) {
    for (let w = budget; w >= task.duration; w--) {
      if (dp[w - task.duration] + task.impact > dp[w]) {
        dp[w] = dp[w - task.duration] + task.impact;
        selected[w] = [...selected[w - task.duration], task.taskId];
      }
    }
  }

  return {
    totalImpact: dp[budget],
    vehicles: selected[budget]
  };
}

async function runVMS() {
  await Log('backend', 'info', PACKAGE, 'Initializing Scheduler...');

  try {
    const DEPOT_API = 'http://20.127.122.201/evaluation-service/depots';
    const VEHICLE_API = 'http://20.127.122.201/evaluation-service/vehicles';

    // Get Depot Constraints
    await Log('backend', 'info', PACKAGE, `Fetching depot details from ${DEPOT_API}`);
    const depotRes = await fetch(DEPOT_API, { headers: { 'Authorization': 'Bearer AUTH' } });
    const depot: Depot = await depotRes.json();

    // Get Vehicle Tasks
    await Log('backend', 'info', PACKAGE, `Fetching vehicle tasks from ${VEHICLE_API}`);
    const vehicleRes = await fetch(VEHICLE_API, { headers: { 'Authorization': 'Bearer AUTH' } });
    const { vehicles }: { vehicles: VehicleTask[] } = await vehicleRes.json();

    await Log('backend', 'info', PACKAGE, `Data received: ${vehicles.length} tasks, ${depot.mechanicHours}hr budget.`);

    //Calculate Optimal Set
    const startTime = Date.now();
    const result = getOptimalSchedule(vehicles, depot.mechanicHours);
    const duration = Date.now() - startTime;

    await Log('backend', 'info', PACKAGE, `Optimization complete in ${duration}ms. Total Impact: ${result.totalImpact}`);

    console.log('--- OPTIMAL MAINTENANCE SCHEDULE ---');
    console.log(`Depot: ${depot.depotId}`);
    console.log(`Max Impact Score: ${result.totalImpact}`);
    console.log(`Selected Task IDs: ${result.vehicles.join(', ')}`);

  } catch (err: any) {
    await Log('backend', 'error', PACKAGE, `Execution failed: ${err.message}`);
  }
}

if (require.main === module) {
  runVMS();
}
