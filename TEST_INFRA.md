# E2E Test Infra: RUSH-APP

## Test Philosophy
- Opaque-box, requirement-driven verification of user-facing endpoints, auth security, HRV scientific computations, and UI integration.
- Methodology: Category-Partition + Boundary Value Analysis + Pairwise Combinatorial + Real-World Workload Testing.

## Test Tiers
1. **Tier 1 - Feature Coverage**:
   - Seed script idempotency
   - Auth registration, login, token issuance
   - Current user profile endpoint (`GET /api/users/me`)
   - HRV daily status calculation & measurement ingestion
   - Workout generation & adaptation
   - Route protection & unauthorized rejection
2. **Tier 2 - Boundary & Corner Cases**:
   - Expired token refresh vs invalid refresh token
   - Day-1 measurement (empty history, 0 mean)
   - Zero standard deviation in HRV history (swc = 0)
   - Extreme lnRMSSD deltas (very high saturation vs very low drop)
   - Role escalation injection during registration (attempt role="owner")
   - Malformed / invalid inputs (invalid gender, negative km, out-of-range RPE)
3. **Tier 3 - Cross-Feature Combinations**:
   - Register -> Onboarding -> Profile check -> First HRV measurement -> Dashboard view
   - Login -> Concurrent parallel requests triggering single token refresh -> Successful responses
   - Periodized plan generation -> Day 1-7 workout retrieval -> HRV status change -> Workout adjustment
4. **Tier 4 - Real-World Application Scenarios**:
   - Full Athlete Lifecycle (New athlete onboarding -> 7 days of HRV recordings -> Training adaptation -> Activity logging -> Feed social kudos)
   - Demo User Login (alessandro@rush.com -> Load dashboard -> Fetch workouts -> Complete workout)

## Verification Semantics
- Test runner scripts can be executed via `node` test scripts against the backend and frontend components.
