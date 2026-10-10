import { execSync } from 'child_process';

const routeTask = (filePath) => {
    console.log(`[ZEE] Analyzing staged changes in: ${filePath}`);
    
    try {
        if (filePath.includes('contracts/')) {
            console.log('[ZEE] Secure domain detected. Handoff to Claude...');
            execSync(`node .claude/audit.js ${filePath}`, { stdio: 'inherit' });
        } else if (filePath.includes('api/') || filePath.includes('apps/')) {
            console.log('[ZEE] Full-stack domain detected. Handoff to Gemini...');
            execSync(`node .gemini/verify.js ${filePath}`, { stdio: 'inherit' });
        } else {
            console.log('[ZEE] Standard file detected. Bypassing specific agent routing.');
        }
    } catch (error) {
        console.error(`[ZEE] 🛑 Autonomous agent rejected the changes in ${filePath}. Commit blocked.`);
        process.exit(1);
    }
};

try {
    const changedFiles = execSync('git diff --cached --name-only').toString().split('\n').filter(Boolean);
    if (changedFiles.length === 0) process.exit(0);
    
    changedFiles.forEach(routeTask);
    console.log('[ZEE] ✅ Autonomous review passed. Proceeding with commit.');
} catch (error) {
    console.error('[ZEE] Routing failure:', error.message);
    process.exit(1);
}
