/**
 * Autonomous Pipeline Monitor
 * Watches AgentZ supervisor ticks and monitors system execution/scaling
 */

import { getDb } from '../db.js';
import { missionTasks } from '../../drizzle/schema.js';
import { eq, gte } from 'drizzle-orm';

export interface PipelineTickMetrics {
  tickId: string;
  timestamp: Date;
  duration: number;
  tasksProcessed: number;
  tasksSucceeded: number;
  tasksFailed: number;
  agentsUsed: string[];
  errorRate: number;
  throughput: number;
}

export interface SystemScaleMetrics {
  timestamp: Date;
  activeAgents: number;
  queuedTasks: number;
  completedTasks24h: number;
  averageTaskDuration: number;
  cpuUsage?: number;
  memoryUsage?: number;
  successRate: number;
  errorMessages: string[];
}

export class PipelineMonitor {
  private tickHistory: PipelineTickMetrics[] = [];
  private scaleHistory: SystemScaleMetrics[] = [];
  private readonly maxHistorySize = 500;
  private lastAlertTime = 0;
  private readonly alertCooldown = 60000; // 1 minute

  /**
   * Record a pipeline tick execution
   */
  async recordTick(tickData: {
    tickId: string;
    duration: number;
    tasksProcessed: number;
    tasksSucceeded: number;
    tasksFailed: number;
    agentsUsed: string[];
  }): Promise<void> {
    const metric: PipelineTickMetrics = {
      tickId: tickData.tickId,
      timestamp: new Date(),
      duration: tickData.duration,
      tasksProcessed: tickData.tasksProcessed,
      tasksSucceeded: tickData.tasksSucceeded,
      tasksFailed: tickData.tasksFailed,
      agentsUsed: tickData.agentsUsed,
      errorRate: tickData.tasksProcessed > 0
        ? (tickData.tasksFailed / tickData.tasksProcessed) * 100
        : 0,
      throughput: tickData.duration > 0
        ? (tickData.tasksProcessed / tickData.duration) * 1000
        : 0
    };

    this.tickHistory.push(metric);
    this.maintainHistorySize();

    // Check for alerts
    await this.checkAlerts(metric);
  }

  /**
   * Record system-wide scaling metrics
   */
  async recordScaleMetrics(metrics: {
    activeAgents: number;
    queuedTasks: number;
    cpuUsage?: number;
    memoryUsage?: number;
  }): Promise<void> {
    const db = await getDb();

    // Query recent completions
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentTasks = await db
      .select()
      .from(missionTasks)
      .where(and(
        gte(missionTasks.createdAt, oneDayAgo),
        eq(missionTasks.status, 'completed')
      ));

    const totalTasks24h = recentTasks.length;
    const succeededTasks24h = recentTasks.filter(t => !t.error).length;

    const scaleMetric: SystemScaleMetrics = {
      timestamp: new Date(),
      activeAgents: metrics.activeAgents,
      queuedTasks: metrics.queuedTasks,
      completedTasks24h: totalTasks24h,
      averageTaskDuration: this.calculateAverageTaskDuration(),
      cpuUsage: metrics.cpuUsage,
      memoryUsage: metrics.memoryUsage,
      successRate: totalTasks24h > 0 ? (succeededTasks24h / totalTasks24h) * 100 : 100,
      errorMessages: this.getRecentErrors(5)
    };

    this.scaleHistory.push(scaleMetric);
    this.maintainHistorySize();
  }

  /**
   * Get recent pipeline metrics
   */
  getRecentTickMetrics(limit: number = 10): PipelineTickMetrics[] {
    return this.tickHistory.slice(-limit);
  }

  /**
   * Get scale metrics history
   */
  getScaleMetricsHistory(limit: number = 10): SystemScaleMetrics[] {
    return this.scaleHistory.slice(-limit);
  }

  /**
   * Get current system health
   */
  getCurrentHealth(): {
    status: 'healthy' | 'degraded' | 'critical';
    lastTick?: PipelineTickMetrics;
    scalingStatus: string;
    recommendations: string[];
  } {
    const lastTick = this.tickHistory[this.tickHistory.length - 1];
    const lastScale = this.scaleHistory[this.scaleHistory.length - 1];

    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
    const recommendations: string[] = [];

    if (lastTick) {
      if (lastTick.errorRate > 20) {
        status = 'critical';
        recommendations.push('High error rate detected - check agent logs');
      } else if (lastTick.errorRate > 10) {
        status = 'degraded';
        recommendations.push('Elevated error rate - monitor closely');
      }

      if (lastTick.duration > 30000) {
        recommendations.push(`Tick duration high (${lastTick.duration}ms) - consider scaling agents`);
      }
    }

    if (lastScale) {
      if (lastScale.queuedTasks > 100) {
        recommendations.push(`Large task queue (${lastScale.queuedTasks}) - increase agents`);
      }

      if (lastScale.successRate < 95) {
        recommendations.push(`Success rate below 95% (${lastScale.successRate.toFixed(1)}%)`);
      }

      if (lastScale.cpuUsage && lastScale.cpuUsage > 80) {
        recommendations.push(`CPU usage high (${lastScale.cpuUsage.toFixed(1)}%) - scale up`);
      }

      if (lastScale.memoryUsage && lastScale.memoryUsage > 85) {
        recommendations.push(`Memory usage high (${lastScale.memoryUsage.toFixed(1)}%) - check for leaks`);
      }
    }

    const scalingStatus = lastScale
      ? `${lastScale.activeAgents} agents, ${lastScale.queuedTasks} queued, ${lastScale.successRate.toFixed(1)}% success rate`
      : 'No scaling data';

    return {
      status,
      lastTick,
      scalingStatus,
      recommendations
    };
  }

  /**
   * Analyze performance trends
   */
  analyzeTrends(): {
    avgErrorRate: number;
    avgThroughput: number;
    avgDuration: number;
    trend: 'improving' | 'stable' | 'degrading';
  } {
    if (this.tickHistory.length < 2) {
      return {
        avgErrorRate: 0,
        avgThroughput: 0,
        avgDuration: 0,
        trend: 'stable'
      };
    }

    const recent = this.tickHistory.slice(-20);
    const avgErrorRate = recent.reduce((sum, t) => sum + t.errorRate, 0) / recent.length;
    const avgThroughput = recent.reduce((sum, t) => sum + t.throughput, 0) / recent.length;
    const avgDuration = recent.reduce((sum, t) => sum + t.duration, 0) / recent.length;

    // Analyze trend by comparing halves
    const mid = Math.floor(recent.length / 2);
    const firstHalf = recent.slice(0, mid);
    const secondHalf = recent.slice(mid);

    const firstHalfError = firstHalf.reduce((sum, t) => sum + t.errorRate, 0) / firstHalf.length;
    const secondHalfError = secondHalf.reduce((sum, t) => sum + t.errorRate, 0) / secondHalf.length;

    let trend: 'improving' | 'stable' | 'degrading' = 'stable';
    if (secondHalfError < firstHalfError - 2) {
      trend = 'improving';
    } else if (secondHalfError > firstHalfError + 2) {
      trend = 'degrading';
    }

    return {
      avgErrorRate,
      avgThroughput,
      avgDuration,
      trend
    };
  }

  /**
   * Get agent utilization
   */
  getAgentUtilization(): Record<string, { uses: number; avgDuration: number }> {
    const agentStats: Record<string, { count: number; totalDuration: number }> = {};

    for (const tick of this.tickHistory) {
      for (const agent of tick.agentsUsed) {
        if (!agentStats[agent]) {
          agentStats[agent] = { count: 0, totalDuration: 0 };
        }
        agentStats[agent].count++;
        agentStats[agent].totalDuration += tick.duration / tick.agentsUsed.length;
      }
    }

    const result: Record<string, { uses: number; avgDuration: number }> = {};
    for (const [agent, stats] of Object.entries(agentStats)) {
      result[agent] = {
        uses: stats.count,
        avgDuration: stats.totalDuration / stats.count
      };
    }

    return result;
  }

  /**
   * Generate human-readable summary
   */
  generateSummary(): string {
    const health = this.getCurrentHealth();
    const trends = this.analyzeTrends();
    const utilization = this.getAgentUtilization();
    const lastScale = this.scaleHistory[this.scaleHistory.length - 1];

    let summary = `
╔════════════════════════════════════════╗
║    AUTONOMOUS PIPELINE MONITOR         ║
╠════════════════════════════════════════╣
`;

    // Health Status
    const statusEmoji = health.status === 'healthy' ? '✅' : health.status === 'degraded' ? '⚠️' : '🔴';
    summary += `│ Status: ${statusEmoji} ${health.status.toUpperCase().padEnd(32)}│\n`;
    summary += `│                                    │\n`;

    // Scaling Info
    if (lastScale) {
      summary += `│ Active Agents: ${lastScale.activeAgents.toString().padEnd(20)}     │\n`;
      summary += `│ Queued Tasks: ${lastScale.queuedTasks.toString().padEnd(21)}     │\n`;
      summary += `│ Success Rate: ${lastScale.successRate.toFixed(1)}%${' '.repeat(20)}     │\n`;
    }

    // Performance Metrics
    summary += `│                                    │\n`;
    summary += `│ Error Rate: ${trends.avgErrorRate.toFixed(1)}%${' '.repeat(21)}     │\n`;
    summary += `│ Throughput: ${trends.avgThroughput.toFixed(2)} tasks/sec${' '.repeat(13)}     │\n`;
    summary += `│ Avg Duration: ${trends.avgDuration.toFixed(0)}ms${' '.repeat(19)}     │\n`;
    summary += `│ Trend: ${trends.trend.toUpperCase().padEnd(26)}     │\n`;

    // Agent Utilization
    summary += `│                                    │\n`;
    summary += `│ Agent Utilization:                 │\n`;
    for (const [agent, stats] of Object.entries(utilization).slice(0, 3)) {
      summary += `│   ${agent.padEnd(14)}: ${stats.uses} uses, ${stats.avgDuration.toFixed(0)}ms avg│\n`;
    }

    // Recommendations
    if (health.recommendations.length > 0) {
      summary += `│                                    │\n`;
      summary += `│ ⚡ Recommendations:                │\n`;
      for (const rec of health.recommendations.slice(0, 3)) {
        const shortRec = rec.length > 30 ? rec.substring(0, 27) + '...' : rec;
        summary += `│   ${shortRec.padEnd(30)}│\n`;
      }
    }

    summary += `╚════════════════════════════════════╝`;

    return summary;
  }

  /**
   * Private helpers
   */

  private async checkAlerts(metric: PipelineTickMetrics): Promise<void> {
    const now = Date.now();

    // Only alert every cooldown period
    if (now - this.lastAlertTime < this.alertCooldown) {
      return;
    }

    if (metric.errorRate > 25) {
      console.error(`🚨 CRITICAL: Error rate ${metric.errorRate.toFixed(1)}% in tick ${metric.tickId}`);
      this.lastAlertTime = now;
    } else if (metric.errorRate > 15) {
      console.warn(`⚠️  WARNING: High error rate ${metric.errorRate.toFixed(1)}% in tick ${metric.tickId}`);
    }

    if (metric.duration > 60000) {
      console.warn(`⚠️  WARNING: Slow tick (${metric.duration}ms) - may indicate scaling issues`);
    }
  }

  private calculateAverageTaskDuration(): number {
    if (this.tickHistory.length === 0) return 0;

    const total = this.tickHistory.reduce((sum, t) => sum + t.duration, 0);
    return total / this.tickHistory.length;
  }

  private getRecentErrors(limit: number): string[] {
    const errors: string[] = [];
    for (const tick of this.tickHistory.slice(-10)) {
      if (tick.errorRate > 0) {
        errors.push(`Tick ${tick.tickId}: ${tick.errorRate.toFixed(1)}% error rate`);
      }
    }
    return errors.slice(0, limit);
  }

  private maintainHistorySize(): void {
    if (this.tickHistory.length > this.maxHistorySize) {
      this.tickHistory = this.tickHistory.slice(-this.maxHistorySize);
    }
    if (this.scaleHistory.length > this.maxHistorySize) {
      this.scaleHistory = this.scaleHistory.slice(-this.maxHistorySize);
    }
  }
}

// Export singleton instance
export const pipelineMonitor = new PipelineMonitor();
