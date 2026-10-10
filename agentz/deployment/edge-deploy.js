import { execSync } from 'child_process';

console.log('\n  🚀 [AgentZ] PR Merge detected. Initiating LIVE edge deployment...');

try {
    // 1. Cloudflare Pages Deployment (Next.js Frontend via OpenNext)
    console.log('\n  🚀 [AgentZ] Building Next.js frontend for Cloudflare Pages...');
    execSync('npx open-next build', { 
        stdio: 'inherit', 
        cwd: './apps/web-client' 
    });

    console.log('  🚀 [AgentZ] Deploying frontend to Cloudflare Pages...');
    // Note: Ensure your Cloudflare Pages project is named 'authichain-web' or update it below
    execSync('npx wrangler pages deploy .open-next/assets --project-name authichain-web', { 
        stdio: 'inherit', 
        cwd: './apps/web-client' 
    });
    console.log('  ✅ [AgentZ] Cloudflare Pages frontend is live!');

    // 2. Cloudflare Workers Deployment (API / Backend)
    console.log('\n  🚀 [AgentZ] Deploying API routes to Cloudflare Workers...');
    execSync('npx wrangler deploy', { 
        stdio: 'inherit', 
        cwd: './api'
    });
    console.log('  ✅ [AgentZ] Cloudflare backend is live!');

    console.log('\n  🎯 [AgentZ] End-to-End Autonomy Complete: Full-stack Cloudflare deployment successful!\n');
} catch (error) {
    console.error('\n  ❌ [AgentZ] Live deployment failed:', error.message);
    process.exit(1);
}
