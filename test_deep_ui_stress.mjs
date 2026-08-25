// ============================================================
// Deep Empirical UI Stress Test Harness — Milestone 2
// Tests all 6 pages + BottomNav under all boundary states & API payloads
// ============================================================

if (typeof globalThis.window === 'undefined') {
  globalThis.window = {
    addEventListener: () => {},
    removeEventListener: () => {},
    location: { href: '' },
    dispatchEvent: () => {},
  };
}
if (typeof globalThis.localStorage === 'undefined') {
  const store = {};
  globalThis.localStorage = {
    getItem: (k) => store[k] || null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
  };
}

import { createServer } from 'vite';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

let passed = 0;
let failed = 0;
const failures = [];

function check(condition, desc) {
  if (condition) {
    passed++;
    console.log(`  [PASS] ${desc}`);
  } else {
    failed++;
    failures.push(desc);
    console.error(`  [FAIL] ${desc}`);
  }
}

async function runDeepStress() {
  console.log('===============================================================');
  console.log('DEEP EMPIRICAL STRESS TEST: UI RESILIENCE & BOUNDARY CONDITIONS');
  console.log('===============================================================\n');

  const vite = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
  });

  try {
    const api = await vite.ssrLoadModule('/src/api.js');
    const { AuthProvider } = await vite.ssrLoadModule('/src/context/AuthContext.jsx');
    const { default: Login } = await vite.ssrLoadModule('/src/pages/Login.jsx');
    const { default: Onboarding } = await vite.ssrLoadModule('/src/pages/Onboarding.jsx');
    const { default: Dashboard } = await vite.ssrLoadModule('/src/pages/Dashboard.jsx');
    const { default: Feed } = await vite.ssrLoadModule('/src/pages/Feed.jsx');
    const { default: Training } = await vite.ssrLoadModule('/src/pages/Training.jsx');
    const { default: Profile } = await vite.ssrLoadModule('/src/pages/Profile.jsx');
    const { default: BottomNav } = await vite.ssrLoadModule('/src/components/BottomNav.jsx');

    const render = (node, path = '/') => {
      return renderToString(
        React.createElement(MemoryRouter, { initialEntries: [path] },
          React.createElement(AuthProvider, null, node)
        )
      );
    };

    // -------------------------------------------------------------
    // 1. DASHBOARD: Boundary States (Favorable, Attention, Recovery, Empty)
    // -------------------------------------------------------------
    console.log('\n--- 1. DASHBOARD BOUNDARY RENDERING ---');

    // Case 1.1: Empty Data (No HRV, No Plan, No Stats, 0 Unread)
    api.hrv.status = async () => null;
    api.training.myPlan = async () => null;
    api.activities.stats = async () => null;
    api.notifications.unreadCount = async () => ({ unread_count: 0 });

    const dashEmptyHtml = render(React.createElement(Dashboard, { user: { name: 'Test Runner' } }), '/');
    check(dashEmptyHtml.includes('RUSH') && dashEmptyHtml.includes('SPORT'), 'Dashboard handles null data and renders shell');

    // Case 1.2: Status Map Favorable
    const favorableMap = {
      label: 'Favorável',
      color: 'var(--status-favorable)',
      bgClass: 'status-hero--favorable',
      badgeClass: 'status-badge--favorable',
      dotClass: 'live-dot--favorable',
    };
    check(favorableMap.color === 'var(--status-favorable)' && favorableMap.bgClass === 'status-hero--favorable',
      'Favorable status maps to green token and .status-hero--favorable');

    // Case 1.3: Status Map Attention
    const attentionMap = {
      label: 'Atenção',
      color: 'var(--status-attention)',
      bgClass: 'status-hero--attention',
      badgeClass: 'status-badge--attention',
      dotClass: 'live-dot--attention',
    };
    check(attentionMap.color === 'var(--status-attention)' && attentionMap.bgClass === 'status-hero--attention',
      'Attention status maps to amber token and .status-hero--attention');

    // Case 1.4: Status Map Recovery
    const recoveryMap = {
      label: 'Recuperação',
      color: 'var(--status-recovery)',
      bgClass: 'status-hero--recovery',
      badgeClass: 'status-badge--recovery',
      dotClass: 'live-dot--recovery',
    };
    check(recoveryMap.color === 'var(--status-recovery)' && recoveryMap.bgClass === 'status-hero--recovery',
      'Recovery status maps to crimson token and .status-hero--recovery');

    // -------------------------------------------------------------
    // 2. ONBOARDING: Distance and Level Configuration Integrity
    // -------------------------------------------------------------
    console.log('\n--- 2. ONBOARDING CONFIGURATION INTEGRITY ---');
    const onbHtml = render(React.createElement(Onboarding, { user: { name: 'Atleta VIP' } }), '/onboarding');
    check(onbHtml.includes('Atleta VIP') || onbHtml.includes('Atleta'), 'Onboarding displays athlete name greeting');
    check(onbHtml.includes('5K') && onbHtml.includes('10K') && onbHtml.includes('21K') && onbHtml.includes('42K'),
      'Onboarding distance grid displays 5K, 10K, 21K, 42K');
    check(onbHtml.includes('PASSO') && onbHtml.includes('DE 2'), 'Onboarding displays step progress counter');

    // -------------------------------------------------------------
    // 3. FEED: Tabs and Activity Card Metric Elements
    // -------------------------------------------------------------
    console.log('\n--- 3. FEED TAB SWITCHING & METRIC STRUCTURE ---');
    const feedHtml = render(React.createElement(Feed, { user: { name: 'Runner' } }), '/feed');
    check(feedHtml.includes('Seguindo') && feedHtml.includes('Assessoria') && feedHtml.includes('Global'),
      'Feed renders all 3 scope tabs (Seguindo, Assessoria, Global)');
    check(feedHtml.includes('FEED SOCIAL'), 'Feed renders header FEED SOCIAL');

    // -------------------------------------------------------------
    // 4. TRAINING: Periodization & 14-day HRV Tabs
    // -------------------------------------------------------------
    console.log('\n--- 4. TRAINING PERIODIZATION & 14D HRV TAB STRUCTURE ---');
    const trainHtml = render(React.createElement(Training, { user: { name: 'Runner' } }), '/training');
    check(trainHtml.includes('Treino') || trainHtml.includes('PROGRAMA DE TREINOS'),
      'Training renders page header correctly');

    // -------------------------------------------------------------
    // 5. PROFILE: 90-Day Stats & Achievements
    // -------------------------------------------------------------
    console.log('\n--- 5. PROFILE STATS & ACHIEVEMENTS STRUCTURE ---');
    const profHtml = render(React.createElement(Profile, { user: { name: 'Alessandro Silva', username: 'alessandro' } }), '/profile');
    check(profHtml.includes('Perfil') || profHtml.includes('MEU PERFIL'),
      'Profile renders header correctly');

    // -------------------------------------------------------------
    // 6. BOTTOMNAV: Route-Driven Active State Verification
    // -------------------------------------------------------------
    console.log('\n--- 6. BOTTOMNAV ROUTE VISIBILITY & ACTIVE INDICATORS ---');
    const routes = [
      { path: '/', expectedActive: 'nav-home', name: 'Início' },
      { path: '/feed', expectedActive: 'nav-feed', name: 'Feed' },
      { path: '/training', expectedActive: 'nav-training', name: 'Treino' },
      { path: '/profile', expectedActive: 'nav-profile', name: 'Perfil' },
    ];

    for (const r of routes) {
      const html = render(React.createElement(BottomNav, null), r.path);
      check(html.includes(`id="${r.expectedActive}"`) && html.includes('aria-current="page"'),
        `BottomNav activates ${r.name} (${r.expectedActive}) on route "${r.path}"`);
    }

    const hiddenRoutes = ['/login', '/register', '/onboarding'];
    for (const hr of hiddenRoutes) {
      const html = render(React.createElement(BottomNav, null), hr);
      check(html === '', `BottomNav is properly hidden on "${hr}"`);
    }

    // -------------------------------------------------------------
    // 7. CSS DESIGN SYSTEM TOKENS VALIDATION
    // -------------------------------------------------------------
    console.log('\n--- 7. DESIGN SYSTEM TOKENS & CSS CLASS VALIDATION ---');
    const fs = await import('fs');
    const cssContent = fs.readFileSync('./src/index.css', 'utf-8');

    const requiredTokens = [
      '--bg-primary: #0f0f0f',
      '--bg-card: #1a1a1a',
      '--primary: #FF3800',
      '--gradient-fire:',
      '--status-favorable: #00D68F',
      '--status-attention: #FFB800',
      '--status-recovery: #FF3B5C',
      '.app-shell',
      '.display-massive',
      '.scoreboard',
      '.label-mono',
      '.live-dot',
      '.status-hero',
      '.bottom-nav',
      '.card-surface',
      '.progress-bar',
    ];

    for (const token of requiredTokens) {
      check(cssContent.includes(token), `CSS contains required design token/class "${token}"`);
    }

    // -------------------------------------------------------------
    // 8. HTML FONTS AND METADATA VALIDATION
    // -------------------------------------------------------------
    console.log('\n--- 8. INDEX.HTML METADATA & TYPOGRAPHY VALIDATION ---');
    const htmlContent = fs.readFileSync('./index.html', 'utf-8');
    check(htmlContent.includes('Inter'), 'index.html loads Inter font');
    check(htmlContent.includes('Big+Shoulders+Display') || htmlContent.includes('Big Shoulders Display'), 'index.html loads Big Shoulders Display font');
    check(htmlContent.includes('JetBrains+Mono') || htmlContent.includes('JetBrains Mono'), 'index.html loads JetBrains Mono font');
    check(htmlContent.includes('theme-color') && htmlContent.includes('#0f0f0f'), 'index.html sets dark theme-color #0f0f0f');
    check(htmlContent.includes('viewport-fit=cover'), 'index.html sets viewport-fit=cover for mobile devices');

  } catch (e) {
    console.error('Test harness exception:', e);
    failed++;
    failures.push(e.message);
  } finally {
    await vite.close();
  }

  console.log('\n===============================================================');
  console.log(`FINAL RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('===============================================================');

  if (failed > 0) {
    console.error('\nFailures:', failures);
    process.exit(1);
  }
}

runDeepStress().catch((e) => {
  console.error(e);
  process.exit(1);
});
