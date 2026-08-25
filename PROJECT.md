# Project: RUSH-APP Enhancement

## Architecture
RUSH-APP is a mobile-first fullstack application (Vite + React 19 + Express + SQLite with better-sqlite3) for running training guided by Heart Rate Variability (HRV / VFC).

### Module & Package Boundaries
1. **Backend (`server/`)**:
   - `server/index.js`: Express server initialization, middleware, routes mounting.
   - `server/db.js`: SQLite connection (`better-sqlite3`), schema migrations, WAL mode.
   - `server/seed.js`: Demo seed script with idempotent demo athletes, academies, challenges, workouts, HRV measurements.
   - `server/middleware/auth.js`: JWT authentication & role-based authorization middleware.
   - `server/routes/`: `auth.js`, `users.js`, `hrv.js`, `training.js`, `activities.js`, `academies.js`, `social.js`, `challenges.js`, `notifications.js`.
   - `server/agent/trainingAgent.js`: Scientific algorithmic engine (lnRMSSD, 7-day baseline, SWC classification, workout adaptation, 4-phase periodization).
2. **Frontend (`src/`)**:
   - `index.html`: Web font loading (`Inter`, `Big Shoulders Display`, `JetBrains Mono`).
   - `src/index.css`: Design system tokens (#0f0f0f, #1a1a1a, #FF3800, gradients, borders, animations, utility classes).
   - `src/api.js`: Unified API client with JWT refresh mutex, error handling, auth helpers.
   - `src/context/AuthContext.jsx`: Centralized auth state, login/register methods, profile fetching, route guards.
   - `src/App.jsx`: Single Router setup, protected route wrapper, onboarding redirect guards.
   - `src/components/BottomNav.jsx`: Mobile navigation bar with editorial active states and Lucide icons.
   - `src/pages/`: `Login.jsx`, `Onboarding.jsx`, `Dashboard.jsx`, `Feed.jsx`, `Training.jsx`, `Profile.jsx`.

---

## Feature Inventory

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F01 | Seed Script Idempotency | Fix `seed.js` to execute idempotently without foreign key constraint crashes on re-runs | M1 | Survey / R1 & R4 |
| F02 | User Registration & Role Safety | Register new user with secure password hash, enforce 'athlete' role default | M1 | Survey / R1 & R4 |
| F03 | User Login & Authentication | Login with email/password (including demo credentials alessandro@rush.com / 123456) | M1 | Survey / R1 |
| F04 | Session Persistence (JWT Access + Refresh) | Access token (15m) + refresh token (7d) rotation with frontend mutex to prevent race conditions | M1 | Survey / R1 |
| F05 | Current User Profile Endpoint (`GET /api/users/me`) | Dedicated route returning profile + `has_onboarding` flag | M1 | Survey / R1 |
| F06 | Routing & Onboarding Redirection | Redirect new/incomplete athletes to `/onboarding`, established athletes to `/` (Dashboard) | M1 | Survey / R1 |
| F07 | Design System Tokens & Global CSS Rewrite | Rewrite `index.css` with dark theme (#0f0f0f, #1a1a1a), orange #FF3800, fire gradients, cards, borders | M2 | Survey / R2 |
| F08 | Typography Integration (Inter, Big Shoulders, JetBrains Mono) | Load required fonts in `index.html` and define `.display-massive`, `.label-mono`, `.scoreboard` | M2 | Survey / R2 |
| F09 | Login & Onboarding UI Redesign | Redesign Login and Onboarding with editorial sports aesthetic, smooth step transitions, and form styling | M2 | Survey / R2 |
| F10 | Dashboard UI Redesign | Redesign Dashboard with HRV gauges, readiness cards, live dot, scoreboard metrics, next workout preview | M2 | Survey / R2 |
| F11 | Feed & Social UI Redesign | Redesign Feed page with activity cards, kudos, comments, achievements, and editorial styling | M2 | Survey / R2 |
| F12 | Training & Periodization UI Redesign | Redesign Training view with weekly calendar, workout cards, zone distribution, periodization phase | M2 | Survey / R2 |
| F13 | Profile & Settings UI Redesign | Redesign Profile page with athlete stats, personal records, settings, and badge grid | M2 | Survey / R2 |
| F14 | BottomNav Component Redesign | Redesign mobile BottomNav with sports icons, active glowing indicators, max-width 430px shell | M2 | Survey / R2 |
| F15 | lnRMSSD & Rolling Baseline Engine | Compute 7-day rolling lnRMSSD mean & SD with day-1 fallbacks and non-zero safety | M3 | Survey / R3 |
| F16 | SWC Status Classification (Favorable/Attention/Recovery) | Classify daily HRV status with lower & upper SWC thresholds, parasympathetic saturation check | M3 | Survey / R3 |
| F17 | Scientific Wellness Integration | Calibrate 5-point wellness scale (sleep, fatigue, soreness, stress, readiness) with non-disruptive weighting | M3 | Survey / R3 |
| F18 | Automatic Workout Prescription Adaptation | Adjust volume, intensity, duration, and distance synchronously based on daily status | M3 | Survey / R3 |
| F19 | 4-Phase Periodization Generator (Base/Build/Peak/Taper) | Generate structured periodized plans with biomechanically sound rest and test session placement | M3 | Survey / R3 |
| F20 | Scientific Citations & Algorithmic Comments | Document literature references (Plews 2013, Buchheit 2014, Kiviniemi 2007) in trainingAgent.js | M3 | Survey / R3 |
| F21 | Backend Error Handling & Route Hardening | Wrap all routes in try/catch with structured JSON error responses (400, 401, 403, 404, 500) | M4 | Survey / R4 |
| F22 | Input Validation & Schema Constraints | Validate body parameters and enums across all endpoints before database operations | M4 | Survey / R4 |
| F23 | Dead Code & Debug Log Cleanup | Remove unused files, orphan imports, and console.logs from production code | M4 | Survey / R4 |
| F24 | E2E Acceptance Verification & Full Suite Pass | Verify all acceptance criteria across auth, UI, training agent, and code quality | M4 | Survey / Acceptance |

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Authentication & Session Management | F01, F02, F03, F04, F05, F06 | none | DONE |
| M2 | Design System & UI Transformation | F07, F08, F09, F10, F11, F12, F13, F14 | M1 | DONE |
| M3 | Training Agent Scientific Logic | F15, F16, F17, F18, F19, F20 | none | DONE |
| M4 | Code Quality, Hardening & E2E Acceptance | F21, F22, F23, F24 | M1, M2, M3 | DONE |

---

## Interface Contracts

### Auth ↔ Client
- `POST /api/auth/register` -> `{ user: { id, email, role, has_onboarding }, token: "jwt", refreshToken: "jwt" }` (201 Created)
- `POST /api/auth/login` -> `{ user: { id, email, role, has_onboarding }, token: "jwt", refreshToken: "jwt" }` (200 OK)
- `POST /api/auth/refresh` -> `{ token: "jwt", refreshToken: "jwt" }` (200 OK)
- `GET /api/users/me` -> `{ id, email, role, name, username, bio, avatar_url, level, weekly_goal_km, has_onboarding, ... }` (200 OK)

### Training Agent ↔ Routes
- `classifyHrvStatus(lnrmssdToday, mean7d, sd7d)` -> `'favorable' | 'attention' | 'recovery'`
- `generateTrainingSuggestion({ athleteProfile, lnrmssdToday, lnrmssd7dMean, lnrmssd7dSd, wellnessScores, plannedSession })` -> `{ status, recommendation, confidence, adjusted_session: { ... }, scientific_basis: { ... } }`
- `generatePeriodizedPlan({ userId, goal, targetDistanceKm, eventDate, currentLevel, weeklyDays })` -> `{ planId, phases: [...], weeks: [...] }`

---

## Code Layout

- `server/index.js`: Server entry point
- `server/db.js`: Database initialization & SQLite pragmas
- `server/seed.js`: Idempotent database seeder
- `server/middleware/auth.js`: JWT authentication & role authorization
- `server/agent/trainingAgent.js`: HRV & periodization scientific logic
- `server/routes/*.js`: API route handlers
- `index.html`: Entry HTML & Google Fonts
- `src/index.css`: Global design system & utility classes
- `src/api.js`: API client & token refresh queue
- `src/context/AuthContext.jsx`: Authentication context & session manager
- `src/App.jsx`: Router, route guards, shell layout
- `src/components/BottomNav.jsx`: Mobile navigation bar
- `src/pages/*.jsx`: Application page views
