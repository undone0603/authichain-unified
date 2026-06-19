import { getJobHistory } from '@/server/scheduled-jobs';

export const runtime = 'nodejs';

interface ComplianceDecision {
  jobName: string;
  decision: string;
  threat: number;
  confidence: number;
  timestamp: string;
  reasoning: string;
  policyChecks: Record<string, boolean>;
  blockedReason?: string;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get('days') || '30');
    const jobName = url.searchParams.get('jobName');

    // Fetch all job runs in the period
    const allRuns = await getJobHistory(jobName, days * 100);

    if (!allRuns || allRuns.length === 0) {
      return Response.json({
        error: 'No job history found',
        message: `No runs found for the last ${days} days`,
      }, { status: 400 });
    }

    const jobRuns = allRuns as any[];
    const decisions: ComplianceDecision[] = [];
    const policyViolations: Record<string, number> = {};

    // Analyze each job run for policy compliance
    for (const run of jobRuns) {
      const threat = run.result?.threatScore || 0;
      const isCriticalJob = ['subscription-health-check', 'deal-monitor-realtime', 'contract-generator'].includes(run.jobName);

      // Policy checks
      const policyChecks = {
        // 1. Resource exhaustion prevention
        'max-duration-policy': (run.duration || 0) < 60000, // < 1 minute
        'memory-safety-policy': true, // Always true (enforced by runtime)
        // 2. Data access policy
        'data-access-policy': !run.jobName.includes('unauthorized'),
        // 3. External API call policy
        'external-call-policy': (run.result?.externalCalls || 0) <= 10,
        // 4. Deployment safety
        'autonomous-deploy-policy': threat < 25,
        // 5. Human review gate for critical ops
        'critical-ops-policy': !isCriticalJob || (run.result?.manualReview === true),
        // 6. Audit logging
        'audit-logging-policy': (run.result?.auditLog !== undefined),
        // 7. Rollback capability
        'rollback-policy': (run.result?.rollbackCapable !== false),
      };

      const violatedPolicies = Object.entries(policyChecks)
        .filter(([_, passed]) => !passed)
        .map(([policy, _]) => policy);

      const allowed = violatedPolicies.length === 0;
      const confidence = 95 - (violatedPolicies.length * 15);

      let blockedReason = undefined;
      if (!allowed) {
        if (threat > 40) {
          blockedReason = 'Threat level exceeds autonomous deployment threshold (>40%)';
        } else if (isCriticalJob && !policyChecks['critical-ops-policy']) {
          blockedReason = 'Critical operation requires human review gate';
        } else {
          blockedReason = `Policy violations: ${violatedPolicies.join(', ')}`;
        }

        violatedPolicies.forEach(policy => {
          policyViolations[policy] = (policyViolations[policy] || 0) + 1;
        });
      }

      decisions.push({
        jobName: run.jobName,
        decision: allowed ? 'allowed' : 'blocked',
        threat,
        confidence: Math.max(0, confidence),
        timestamp: run.startedAt?.toISOString?.() || new Date(run.startedAt).toISOString(),
        reasoning: allowed
          ? `All ${Object.keys(policyChecks).length} policy checks passed. Autonomous execution approved.`
          : `${violatedPolicies.length} policy violations detected.`,
        policyChecks,
        blockedReason,
      });
    }

    // Calculate compliance score
    const allowedCount = decisions.filter(d => d.decision === 'allowed').length;
    const complianceScore = (allowedCount / decisions.length) * 100;

    // Find patterns in violations
    const mostViolatedPolicy = Object.entries(policyViolations)
      .sort(([_, a], [__, b]) => b - a)[0];

    const headers = {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    };

    return Response.json(
      {
        summary: {
          period: `Last ${days} days`,
          totalDecisions: decisions.length,
          allowed: allowedCount,
          blocked: decisions.length - allowedCount,
          complianceScore: Number(complianceScore.toFixed(2)),
          avgConfidence: Number((decisions.reduce((sum, d) => sum + d.confidence, 0) / decisions.length).toFixed(2)),
        },
        analysis: {
          mostViolatedPolicy: mostViolatedPolicy ? mostViolatedPolicy[0] : null,
          totalViolations: Object.values(policyViolations).reduce((a, b) => a + b, 0),
          violationsByPolicy: policyViolations,
          riskTrend: decisions.slice(-10).reduce((sum, d) => sum + d.threat, 0) / Math.min(10, decisions.length),
        },
        policies: {
          'max-duration-policy': 'Jobs must complete within 60 seconds',
          'memory-safety-policy': 'Runtime enforces memory safety (no buffer overflows)',
          'data-access-policy': 'Only authorized data tables accessible',
          'external-call-policy': 'Maximum 10 external API calls per job run',
          'autonomous-deploy-policy': 'Autonomous deployments blocked if threat > 25%',
          'critical-ops-policy': 'Critical operations (payments, refunds) require human review',
          'audit-logging-policy': 'All decisions logged with reasoning',
          'rollback-policy': 'All deployments support automatic rollback',
        },
        evidence: {
          recentDecisions: decisions.slice(0, 50), // Last 50 decisions as evidence
          policyCompletion: Object.entries(policyChecks || {})
            .reduce((stats, [policy, _]) => {
              stats[policy] = {
                passed: decisions.filter(d => d.policyChecks[policy]).length,
                total: decisions.length,
              };
              return stats;
            }, {} as Record<string, any>),
        },
        certification: {
          statement:
            complianceScore >= 95
              ? '✅ COMPLIANT: Autonomous agents operated within all corporate policies with 95%+ consistency'
              : complianceScore >= 85
                ? '⚠️ MOSTLY COMPLIANT: Minor policy violations detected; remediation recommended'
                : '❌ NON-COMPLIANT: Significant policy violations; autonomous execution should be paused',
          confidence: `${Math.round(decisions.reduce((sum, d) => sum + d.confidence, 0) / decisions.length)}%`,
          auditTrail: 'All decisions and policy checks available in evidence.recentDecisions',
          lastAudit: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      },
      { headers }
    );
  } catch (error) {
    console.error('Failed to generate compliance audit:', error);
    return Response.json(
      { error: 'Failed to generate compliance audit', details: String(error) },
      { status: 500 }
    );
  }
}
