const fs = require('fs');
const path = require('path');

function verify() {
  console.log("Starting verification...");

  const settingsPath = path.join(__dirname, 'settings.json');
  if (!fs.existsSync(settingsPath)) {
    console.error("ERROR: .gemini/settings.json does not exist");
    process.exit(1);
  }

  let settings;
  try {
    const raw = fs.readFileSync(settingsPath, 'utf8');
    settings = JSON.parse(raw);
  } catch (err) {
    console.error("ERROR: Failed to parse .gemini/settings.json:", err.message);
    process.exit(1);
  }

  console.log("Validating settings.json content...");

  if (!settings.skills || !Array.isArray(settings.skills.directories)) {
    console.error("ERROR: skills.directories must be an array");
    process.exit(1);
  }

  for (const dir of settings.skills.directories) {
    if (!fs.existsSync(dir)) {
      console.error(`ERROR: Skill directory does not exist: ${dir}`);
      process.exit(1);
    }
    console.log(`Verified skill directory exists: ${dir}`);
  }

  const requiredFiles = [
    'agentz/launch-observer.md',
    'agentz/workspace-layer-navigator.md',
    '.cursor/rules/live-money.mdc'
  ];

  for (const file of requiredFiles) {
    if (!fs.existsSync(file)) {
      console.error(`ERROR: Required skill file does not exist: ${file}`);
      process.exit(1);
    }
    console.log(`Verified skill file exists: ${file}`);
  }

  if (settings.auto_load !== true) {
    console.error("ERROR: auto_load must be true");
    process.exit(1);
  }

  if (settings.preserve_layer_state !== true) {
    console.error("ERROR: preserve_layer_state must be true");
    process.exit(1);
  }

  const activeSkills = settings.active_skills;
  const expectedSkills = ["launch_observer", "workspace_layer_navigator", "live_money"];
  if (!Array.isArray(activeSkills) || JSON.stringify(activeSkills) !== JSON.stringify(expectedSkills)) {
    console.error("ERROR: active_skills mismatch");
    process.exit(1);
  }

  console.log("Verification SUCCESS: All settings and skill files are valid.");
}

verify();
