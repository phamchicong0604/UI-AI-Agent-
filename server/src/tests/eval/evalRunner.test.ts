import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { EvalRunner, EvalMetrics } from './evalRunner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('AI Document Pipeline Evaluation Framework (Epic E9-T3, E9-T4)', () => {
  it('executes full evaluation suite and verifies benchmark against recorded baseline (BUG-007)', async () => {
    const { metrics, detailedResults } = await EvalRunner.run();

    // Verify baseline file exists and read it without overwriting
    const baselinePath = path.join(__dirname, 'baseline.json');
    expect(fs.existsSync(baselinePath)).toBe(true);

    const baselineJson: EvalMetrics = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'));

    expect(metrics.totalCases).toBeGreaterThanOrEqual(8);

    // AC-E9-1: Classification accuracy threshold >= 85% and no regression against baseline (-2%)
    expect(metrics.classificationAccuracy).toBeGreaterThanOrEqual(85.0);
    expect(metrics.classificationAccuracy).toBeGreaterThanOrEqual(baselineJson.classificationAccuracy - 2.0);

    // AC-E9-2: Conflict detection recall >= 85% and no regression against baseline (-2%)
    expect(metrics.conflictDetectionRecall).toBeGreaterThanOrEqual(85.0);
    expect(metrics.conflictDetectionRecall).toBeGreaterThanOrEqual(baselineJson.conflictDetectionRecall - 2.0);

    // Conflict detection precision >= 85% and zero false positive conflicts (BUG-007)
    expect(metrics.conflictDetectionPrecision).toBeGreaterThanOrEqual(85.0);
    expect(metrics.conflictFalsePositives).toBe(0);

    // Grounded verbatim extraction precision >= 80% and recall >= 80% (BUG-007)
    expect(metrics.extractionPrecision).toBeGreaterThanOrEqual(80.0);
    expect(metrics.extractionRecall).toBeGreaterThanOrEqual(80.0);

    // All test results must have valid classifications
    expect(detailedResults.length).toBe(metrics.totalCases);
    for (const res of detailedResults) {
      expect(res.predictedCategory).toBeDefined();
      expect(res.primaryScore).toBeGreaterThan(0);
    }
  });
});
