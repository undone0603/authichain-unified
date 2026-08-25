#!/usr/bin/env tsx

/**
 * Live Monitor for Autonomous Pipeline
 * Watch AgentZ supervisor ticks in real-time, monitor execution and scaling
 *
 * Usage: npx tsx scripts/monitor-autonomous-pipeline.ts [--interval=5000] [--verbose]
 */

import 'dotenv/config';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { pipelineMonitor } from '../server/monitoring/pipeline-monitor.js';
import { getDb } from '../server/db.js';
import { missionTasks } from '../drizzle/schema.js';
import { desc } from 'drizzle-orm';

const args = process.argv.slice(2);
const intervalStr = args.find(a => a.startsWith('--interval='))?.split('=')[1];
const verbose = args.includes('--verbose');
const interval = intervalStr ? parseInt(intervalStr) : 5000;

console.log(`🚀 AuthiChain Autonomous Pipeline Monitor`);
console.log(`📊 Polling interval: ${interval}ms`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

let tickCount = 0;
let lastDisplayTime = Date.now();

/**
 * Poll the pipeline state
 */
async function pollPipeline() {
  try {
    // For now, use mock metrics until systemMetrics table is created
    // In production, this would query actual system metrics
    const mockMetric = {
      activeAgents: Math.floor(Math.random() * 5) + 1,
      queuedTasks: Math.floor(Math.random() * 20),
      cpuUsage: Math.random() * 100,
      memoryUsage: Math.random() * 100
    };

    // Record in monitor
    await pipelineMonitor.recordScaleMetrics(mockMetric);

    tickCount++;

    // Display summary every 10 ticks or 50 seconds
    if (tickCount % 10 === 0 || Date.now() - lastDisplayTime > 50000) {
      displaySummary();
      lastDisplayTime = Date.now();
    } else {
      displayMinimal(mockMetric);
    }

    if (verbose) {
      displayVerbose(mockMetric);
    }
  } catch (error) {
    console.error('❌ Monitor error:', error instanceof Error ? error.message : error);
  }
}

/**
 * Display minimal real-time metrics
 */
function displayMinimal(metric: any) {
  const health = pipelineMonitor.getCurrentHealth();
  const statusIcon = health.status === 'healthy' ? '✅' : health.status === 'degraded' ? '⚠️' : '🔴';

  const line = `${statusIcon} [${new Date().toLocaleTimeString()}] ` +
    `Agents: ${metric.activeAgents} | ` +
    `Queue: ${metric.queuedTasks} | ` +
    `CPU: ${metric.cpuUsage?.toFixed(1)}% | ` +
    `Mem: ${metric.memoryUsage?.toFixed(1)}%`;

  console.log(line);
}

/**
 * Display full summary
 */
function displaySummary() {
  const summary = pipelineMonitor.generateSummary();
  console.clear();
  console.log(summary);
}

/**
 * Display verbose debugging info
 */
function displayVerbose(metric: any) {
  const trends = pipelineMonitor.analyzeTrends();
  const utilization = pipelineMonitor.getAgentUtilization();

  console.log('\n📈 Detailed Metrics:');
  console.log('  Trends:', trends);
  console.log('  Agent Utilization:', utilization);
  console.log('  Raw Metric:', metric);
  console.log('');
}

/**
 * Display key alerts
 */
function checkAndDisplayAlerts() {
  const health = pipelineMonitor.getCurrentHealth();

  if (health.recommendations.length > 0) {
    console.log('\n🔔 Recommendations:');
    health.recommendations.forEach(rec => {
      console.log(`  • ${rec}`);
    });
  }

  if (health.status === 'critical') {
    console.error('\n🚨 CRITICAL STATUS - Immediate action may be needed!');
  } else if (health.status === 'degraded') {
    console.warn('\n⚠️  DEGRADED STATUS - Monitor closely');
  }
}

/**
 * Display help
 */
function displayHelp() {
  console.log(`
Usage: npx tsx scripts/monitor-autonomous-pipeline.ts [OPTIONS]

Options:
  --interval=MS      Polling interval in milliseconds (default: 5000)
  --verbose          Show detailed debugging information
  --help             Show this help message

Keyboard Commands:
  q or Ctrl+C        Quit the monitor
  s                  Show full summary
  h                  Show health status
  t                  Show trends
  u                  Show agent utilization

Examples:
  npx tsx scripts/monitor-autonomous-pipeline.ts
  npx tsx scripts/monitor-autonomous-pipeline.ts --interval=2000 --verbose
`);
}

/**
 * Handle interactive commands
 */
if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on('data', (key) => {
    const char = key.toString().toLowerCase();

    switch (char) {
      case 'q':
      case '\x03': // Ctrl+C
        console.log('\n👋 Monitor stopped');
        process.exit(0);
        break;
      case 's':
        displaySummary();
        break;
      case 'h':
        const health = pipelineMonitor.getCurrentHealth();
        console.log('\n', health);
        break;
      case 't':
        const trends = pipelineMonitor.analyzeTrends();
        console.log('\n', trends);
        break;
      case 'u':
        const util = pipelineMonitor.getAgentUtilization();
        console.log('\n', util);
        break;
      case '?':
        displayHelp();
        break;
    }
  });
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n👋 Monitor stopped');
  process.exit(0);
});

// Start monitoring
console.log(`\n⏳ Monitoring started... (Press 's' for summary, '?' for help)\n`);

// Display initial summary
setTimeout(() => {
  displaySummary();
  setInterval(pollPipeline, interval);
}, 2000);
