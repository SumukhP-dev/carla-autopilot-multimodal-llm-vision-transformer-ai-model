/**
 * Synthetic CARLA simulation metrics (matches collision-risk-backend/test-api.js shape).
 */
export function buildSimulationPayload(vuId, iteration) {
  const seed = vuId * 1000 + iteration;
  const collisions = seed % 12;
  const safeRuns = 100 - collisions;
  const safetyRate = safeRuns;

  return {
    name: `k6-load-vu${vuId}-iter${iteration}`,
    collisions,
    safeRuns,
    safetyRate,
    gradeLevel: safetyRate >= 90 ? 'A' : safetyRate >= 75 ? 'B' : 'C',
    speedStats: { mean: 5.5 + (seed % 10) / 10, std: 1.2, variance: 1.44 },
    steeringStats: { mean: 0.1, std: 0.05, variance: 0.0025 },
    fpsStats: { mean: 28 + (seed % 5), std: 2.0 },
    processingStats: {
      vision: { mean: 0.1 },
      audio: { mean: 0.2 },
      llm: { mean: 0.3 },
      total: { mean: 0.6 },
    },
    speedCV: 21.82,
    steeringCV: 50.0,
    totalFrames: 1000 + (seed % 500),
    avgFPS: 28 + (seed % 5),
  };
}
