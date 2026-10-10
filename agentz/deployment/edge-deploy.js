import { execSync } from 'child_process';

console.log('\n  🚀 [AgentZ] PR Merge detected. Initiating LIVE edge deployment...');

try {
    // 1. Vercel Deployment (Next.js Frontend)
    console.log('\n  🚀 [AgentZ] Pulling Vercel production environment...');
    execSync('npx vercel pull --yes --environment=production --token=$VERCEL_TOKEN', { 
        stdio: 'inherit', 
        cwd: './apps/web-client'
    });

    console.log('  🚀 [AgentZ] Building Next.js project for Vercel Edge...');
    execSync('npx vercel build --prod --token=$VERCEL_TOKEN', { 
        stdio: 'inherit', 
        cwd: './apps/web-client'
    });

    console.log('  🚀 [AgentZ] Pushing build to Vercel...');
    execSync('npx vercel deploy --prebuilt --prod --token=$VERCEL_TOKEN', { 
        stdio: 'inherit', 
        cwd: './apps/web-client'
    });
    console.log('  ✅ [AgentZ] Frontend successfully deployed to Vercel!');

    // 2. Cloudflare Deployment (API / Backend)
    console.log('\n  🚀 [AgentZ] Deploying API routes to Cloudflare Workers...');
    execSync('npx wrangler deploy', { 
        stdio: 'inherit', 
        cwd: './api'
    });
    console.log('  ✅ [AgentZ] Cloudflare API routes live!');

    console.log('\n  🎯 [AgentZ] End-to-End Autonomy Complete: Production is live!\n');
} catch (error) {
    console.error('\n  ❌ [AgentZ] Live deployment failed:', error.message);
    process.exit(1);
}
