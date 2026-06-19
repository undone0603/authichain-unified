import { getJobHistory } from '@/server/scheduled-jobs';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    // Get latest threat intelligence from JOB 36
    const threatHistory = await getJobHistory('cross-vertical-threat-intelligence', 1);

    if (!threatHistory || threatHistory.length === 0) {
      return Response.json({
        status: 'unknown',
        message: 'Threat intelligence not yet computed',
        timestamp: new Date().toISOString(),
      });
    }

    const latestThreat = threatHistory[0] as any;
    const threatData = latestThreat.result || {};

    // Extract deployment gates
    const deploymentGates = threatData.deploymentGates || {};
    const patternAnalysis = threatData.patternAnalysis || {};

    // Determine if system is safe for autonomous deployment
    const safeForDeployment = Object.values(deploymentGates).every((gate: any) => gate.canDeploy);
    const criticalBrands = Object.entries(deploymentGates)
      .filter(([_, gate]: [string, any]) => !gate.canDeploy)
      .map(([brand, _]) => brand);

    const headers = {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60',
    };

    return Response.json(
      {
        safeForAutonomousDeployment: safeForDeployment,
        systemStatus: patternAnalysis.systemStatus || 'unknown',
        threatLevel: patternAnalysis.avgSystemThreat || 0,
        blockedBrands: criticalBrands,
        deploymentGates,
        patternAnalysis,
        decision: {
          recommendation: patternAnalysis.recommendation,
          canProceed: safeForDeployment,
          confidence: safeForDeployment ? 95 : Math.max(0, 50 - (patternAnalysis.avgSystemThreat || 0)),
          nextReassessmentIn: '10 minutes',
        },
        lastAssessment: latestThreat.startedAt,
        timestamp: new Date().toISOString(),
      },
      { headers }
    );
  } catch (error) {
    console.error('Failed to get deployment gates:', error);
    return Response.json(
      { error: 'Failed to get deployment gates', details: String(error) },
      { status: 500 }
    );
  }
}
