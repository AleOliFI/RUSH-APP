// ============================================================
// Milestone 2 Challenger 1: Design System & Full UI Verification Suite
// Empirical verification of CSS tokens, typography, mobile shell,
// and component design system classes across all 6 pages + BottomNav.
// ============================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

const REQUIRED_HEX_COLORS = [
  '#0f0f0f', // Primary dark background
  '#1a1a1a', // Dark card surface
  '#FF3800', // Rush Fire Orange primary
  '#D83000', // Primary CTA dark orange
  '#00D68F', // Status Favorable (green)
  '#FFB800', // Status Attention (yellow)
  '#FF3B5C', // Status Recovery (red)
];

// Famílias do design system legado, hoje servidas por public/fonts/fonts.css
// em vez do CDN do Google.
const REQUIRED_FONTS = [
  'Inter',
  'Big Shoulders Display',
  'JetBrains Mono',
];

const REQUIRED_DESIGN_CLASSES = [
  'app-shell',
  'display-massive',
  'display-title',
  'scoreboard',
  'label-mono',
  'live-dot',
  'card-surface',
  'card',
  'status-hero',
  'status-badge',
  'workout-card',
  'feed-card',
  'bottom-nav',
  'nav-item',
  'progress-bar',
  'progress-fill',
  'text-gradient',
  'stripe-pattern',
  'orange-glow',
];

// As páginas .jsx legadas (Login, Onboarding, Dashboard, Feed, Training,
// Profile, CoachDashboard) foram substituídas pelas telas em src/screens,
// montadas pelo RushShell. A barra inferior legada saiu com a última
// delas, o painel da assessoria — restou aqui só o shell da aplicação.
const PAGES_AND_COMPONENTS = [
  { name: 'App.jsx', file: 'src/App.jsx', requiredClasses: ['app-shell'] },
];


let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const errors = [];

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${message}`);
  } else {
    failedTests++;
    console.error(`  [FAIL] ${message}`);
    errors.push(message);
  }
}

console.log('============================================================');
console.log('M2 CHALLENGER 1: Automated Verification Suite');
console.log('============================================================\n');

// ------------------------------------------------------------
// 1. Verify index.html Font Imports & Meta Configuration
// ------------------------------------------------------------
console.log('--- Step 1: index.html Verification ---');
const indexHtmlPath = path.join(ROOT_DIR, 'index.html');
assert(fs.existsSync(indexHtmlPath), 'index.html exists');
const indexHtmlContent = fs.readFileSync(indexHtmlPath, 'utf8');

assert(indexHtmlContent.includes('/fonts/fonts.css'), 'index.html links the locally hosted font stylesheet');
assert(
  !indexHtmlContent.includes('fonts.googleapis.com'),
  'index.html does not depend on the Google Fonts CDN',
);

const fontsCssPath = path.join(ROOT_DIR, 'public/fonts/fonts.css');
assert(fs.existsSync(fontsCssPath), 'public/fonts/fonts.css exists');
const fontsCssContent = fs.readFileSync(fontsCssPath, 'utf8');
REQUIRED_FONTS.forEach((font) => {
  assert(fontsCssContent.includes(`font-family: '${font}'`), `fonts.css declares ${font}`);
});

assert(indexHtmlContent.includes('name="viewport"'), 'index.html contains responsive viewport meta tag');
assert(
  indexHtmlContent.includes('theme-color') && /#0[dDfF]0[dDfF]0[dDfF]/.test(indexHtmlContent),
  'index.html has a dark theme-color (#0D0D0D no design system novo, #0f0f0f no legado)',
);

// ------------------------------------------------------------
// 2. Verify src/index.css Design System Tokens & Classes
// ------------------------------------------------------------
console.log('\n--- Step 2: legacy design system stylesheet Verification ---');
// src/index.css virou apenas o orquestrador das camadas; o design system
// legado (usado por /coach) vive em src/styles/rush-legacy.css.
const indexCssPath = path.join(ROOT_DIR, 'src/index.css');
const legacyCssPath = path.join(ROOT_DIR, 'src/styles/rush-legacy.css');
assert(fs.existsSync(indexCssPath), 'src/index.css exists');
assert(fs.existsSync(legacyCssPath), 'src/styles/rush-legacy.css exists');
const orchestratorCss = fs.readFileSync(indexCssPath, 'utf8');
assert(orchestratorCss.includes('rush-legacy'), 'src/index.css imports the legacy stylesheet');
const indexCssContent = fs.readFileSync(legacyCssPath, 'utf8');

console.log('Checking required Hex Colors in index.css:');
REQUIRED_HEX_COLORS.forEach((hex) => {
  const hexPattern = new RegExp(hex.replace('#', '#'), 'i');
  assert(hexPattern.test(indexCssContent), `index.css contains hex color token ${hex}`);
});

console.log('Checking required CSS class definitions:');
REQUIRED_DESIGN_CLASSES.forEach((cls) => {
  const classPattern = new RegExp(`\\.${cls}\\b`);
  assert(classPattern.test(indexCssContent), `index.css defines .${cls} class`);
});

// Mobile Shell Viewport Constraint
console.log('Checking mobile-first viewport constraints:');
const appShellMatch = indexCssContent.match(/\.app-shell\s*\{([^}]+)\}/s);
assert(appShellMatch !== null, '.app-shell rule exists in index.css');
if (appShellMatch) {
  const shellBody = appShellMatch[1];
  assert(/max-width:\s*430px/i.test(shellBody), '.app-shell has max-width: 430px');
  assert(/margin:\s*0\s+auto/i.test(shellBody), '.app-shell has margin: 0 auto centering');
  assert(/min-height:\s*100(vh|dvh)/i.test(shellBody), '.app-shell enforces min-height viewport');
}

const bottomNavMatch = indexCssContent.match(/\.bottom-nav\s*\{([^}]+)\}/s);
assert(bottomNavMatch !== null, '.bottom-nav rule exists in index.css');
if (bottomNavMatch) {
  const navBody = bottomNavMatch[1];
  assert(/max-width:\s*430px/i.test(navBody), '.bottom-nav enforces max-width: 430px');
  assert(/fixed/i.test(navBody), '.bottom-nav is position: fixed');
}

// ------------------------------------------------------------
// 3. Verify Design System Classes across All 6 Pages + BottomNav + App
// ------------------------------------------------------------
console.log('\n--- Step 3: Component & Page Design Class Verification ---');

function fileHasClass(fileContent, cls) {
  const escapedCls = cls.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const regex = new RegExp(`\\b${escapedCls}\\b`);
  return regex.test(fileContent);
}

PAGES_AND_COMPONENTS.forEach(({ name, file, requiredClasses }) => {
  const filePath = path.join(ROOT_DIR, file);
  assert(fs.existsSync(filePath), `${name} exists at ${file}`);
  if (fs.existsSync(filePath)) {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    requiredClasses.forEach((cls) => {
      assert(fileHasClass(fileContent, cls), `${name} contains design class "${cls}"`);
    });
  }
});

// ------------------------------------------------------------
// 4. Adversarial Edge Case & Syntax Stress-Testing
// ------------------------------------------------------------
console.log('\n--- Step 4: Adversarial Syntax & Quality Checks ---');

// Check that no orphaned debug console.log remains in frontend pages
PAGES_AND_COMPONENTS.forEach(({ name, file }) => {
  const filePath = path.join(ROOT_DIR, file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    const debugLogs = content.match(/console\.log\([^)]+\)/g) || [];
    assert(debugLogs.length === 0, `${name} has 0 console.log debug statements (found ${debugLogs.length})`);
  }
});

// Check that all Lucide imports exist and are properly imported
PAGES_AND_COMPONENTS.forEach(({ name, file }) => {
  const filePath = path.join(ROOT_DIR, file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lucideImportMatch = content.match(/import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"]/);
    if (lucideImportMatch) {
      const importedIcons = lucideImportMatch[1].split(',').map(s => s.trim()).filter(Boolean);
      assert(importedIcons.length > 0, `${name} imports ${importedIcons.length} Lucide icon(s)`);
    }
  }
});

// Check CSS brace balancing
let openBraces = (indexCssContent.match(/\{/g) || []).length;
let closeBraces = (indexCssContent.match(/\}/g) || []).length;
assert(openBraces === closeBraces, `index.css has balanced braces (${openBraces} open == ${closeBraces} close)`);

// ------------------------------------------------------------
// Final Summary & Verdict
// ------------------------------------------------------------
console.log('\n============================================================');
console.log(`TOTAL TESTS: ${totalTests}`);
console.log(`PASSED: ${passedTests}`);
console.log(`FAILED: ${failedTests}`);
console.log('============================================================\n');

if (failedTests > 0) {
  console.error('FAILURES DETECTED:');
  errors.forEach((err, idx) => console.error(`  ${idx + 1}. ${err}`));
  process.exit(1);
} else {
  console.log('VERDICT: ALL TESTS PASSED SUCCESSFULLY (APPROVE)');
  process.exit(0);
}
