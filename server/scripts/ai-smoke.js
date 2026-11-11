import { config } from '../src/config/env.js';
import { evaluateWithGrok } from '../src/services/grokService.js';

if (!config.xaiApiKey || !config.xaiModel) {
  console.error('[ai-smoke] BLOCKED: set XAI_API_KEY and XAI_MODEL in server/.env. No API request was made.');
  process.exitCode = 2;
} else {
  try {
    const text = 'Synthetic academic report for an integration smoke test. Abstract: This project explores campus resource discovery. Introduction: Students need accessible academic guidance. Problem: resources are fragmented. Objectives: create a searchable resource portal. Literature review: no sources have yet been analyzed. Methodology: iterative MERN prototype with role-based access. Implementation: React, Express and MongoDB. Results: no measured user study has been completed. Conclusion: the prototype needs formal usability evaluation. References: none provided.';
    const result = await evaluateWithGrok(text);
    console.log(JSON.stringify({ status: 'passed', model: config.xaiModel, criteria: result.criteria.length, totalScore: result.totalScore, syntheticReport: true, savedToDatabase: false }));
  } catch (error) {
    console.error(`[ai-smoke] Failed: ${error.code || error.name}. ${error.message}`);
    process.exitCode = 1;
  }
}
