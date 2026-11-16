# E2E Tests for Recommendation Flow (V2)

This directory contains Playwright end-to-end tests for the recommendation flow.

## Requirements

- Node.js v18+
- Frontend running on `http://localhost:3000`
- ML Service running on `http://localhost:8000` (spaCy required for NLP features)

## Setup

Install Playwright and dependencies:

```bash
cd frontend-comensales
npm install
npx playwright install chromium
```

## Running Tests

### Run all tests:

```bash
npm run test:e2e
```

### Run tests with UI:

```bash
npm run test:e2e:ui
```

### View test report:

```bash
npm run test:e2e:report
```

### Run specific test file:

```bash
npx playwright test recommendations.spec.ts
```

### Run tests in headed mode:

```bash
npx playwright test --headed
```

## Test Suite Overview

### TC-001: Cuestionario Wizard Display
- Verifies the wizard appears on the home page
- Checks accessibility attributes

### TC-002: Complete Cuestionario Submission
- Tests filling all 5 steps of the wizard
- Verifies progression through steps
- Submits the form successfully

### TC-003: Recommendations Display
- Tests recommendation fetching after cuestionario submission
- Verifies dish name, restaurant, and match score display

### TC-004: Allergy Filtering
- Tests filtering by allergies (camaron, lacteos, gluten)
- Verifies allergy indicators are shown

### TC-005: Diet Filtering
- Tests filtering by diet (vegana, vegetariana, sin_gluten)
- Verifies diet indicators are shown

### TC-006: Negation Detection
- Tests detection of "no quiero" and "sin [item]" patterns
- Verifies ML service handles negations correctly

### TC-007: Restaurant Drawer Navigation
- Tests opening the restaurant drawer/list
- Verifies restaurant items display correctly
- Tests drawer close functionality

### TC-008: Accessibility Features
- Verifies aria-labels on interactive elements
- Tests keyboard navigation support

### TC-009: Error Handling and Fallback
- Tests graceful degradation when ML service is unavailable
- Verifies fallback recommendations are shown

### TC-010: Complete End-to-End Flow
- Tests the entire user journey
- Verifies all components work together

## Test Data

The tests use the following data:
- **Craving Text**: Spanish food descriptions (e.g., "Quiero tacos al pastor")
- **Craving Tags**: picante, caldosito, italiana, japonesa, mexicana, rapida
- **Diet Options**: none, vegetariana, vegana, sin_gluten, keto
- **Allergy Options**: cacahuate, camaron, lacteos, gluten, huevo, pescado, nueces, mariscos
- **Social Context**: solo, pareja, familia, amigos

## Accessibility Testing

All tests verify:
- Proper aria-label attributes on interactive elements
- Consistent focus management
- Keyboard navigation support
- Screen reader-friendly markup

## CI/CD Integration

Tests are configured to:
- Run on CI with 2 retries
- Use a single worker
- Record videos of failed tests
- Generate HTML reports

## Troubleshooting

### Tests fail with connection refused
Ensure the frontend is running on port 3000:
```bash
npm run dev
```

### spaCy NLP not working
Ensure the ML service has spaCy installed:
```bash
pip install -r requirements.txt
python -m spacy download es_core_news_sm
```

### Test timeout
Increase timeout in playwright.config.ts or run with:
```bash
npx playwright test --timeout=120000
```
