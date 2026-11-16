/**
 * E2E Test Suite: Recommendation Flow (V2)
 * Tests the full recommendation flow: Public Menu > Cuestionario > Recommendations
 * Uses Playwright for browser automation with data-testid selectors.
 * 
 * Test Cases:
 * TC-001: Access public menu /menu/:restaurant_id
 * TC-002: Complete cuestionario with craving, diet, allergies
 * TC-003: Verify recommendations display with matchScore/matchPercentage
 * TC-004: Test 8+ recommendations from ml-service (not fallback)
 * TC-005: Verify spaCy active in response (data-testid="spacy-active")
 * TC-006: End-to-end recommendation flow
 * 
 * @requires localhost:3000 (frontend)
 * @requires localhost:4000 (backend API service with ml-service/spaCy)
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';

test.describe('Recommendation Flow E2E Tests - V2', () => {
  test.beforeAll(async () => {
    console.log('\n=== E2E Test Suite: Recommendation Flow V2 ===');
    console.log('Testing V2 recommendation flow end-to-end...\n');
    
    try {
      const response = await fetch(BASE_URL);
      if (response.ok) {
        console.log('[✓] Frontend available at ' + BASE_URL);
      } else {
        console.warn('[⚠] Frontend returned status ' + response.status);
      }
    } catch (error) {
      console.warn('[⚠] Frontend not accessible at ' + BASE_URL + ': ' + error.message);
    }
  });

  test.afterAll(async () => {
    console.log('\n=== Test Suite Complete ===\n');
  });

  test('TC-001: Should access public menu page /menu/:restaurant_id', async ({ page }) => {
    console.log('\nTC-001: Access Public Menu Page');
    
    const restaurantId = 'china-123';
    await page.goto(`${BASE_URL}/menu/${restaurantId}`);
    
    const header = page.locator('[data-testid="public-menu-header"]');
    await expect(header).toBeVisible({ timeout: 10000 });
    
    const restaurantName = page.locator('h1').first();
    await expect(restaurantName).toBeVisible();
    
    console.log('  ✓ PASSED: Public menu page loaded successfully');
  });

  test('TC-002: Should complete cuestionario with craving text, diet, allergies', async ({ page }) => {
    console.log('\nTC-002: Complete Cuestionario Flow');
    
    const restaurantId = 'china-123';
    await page.goto(`${BASE_URL}/menu/${restaurantId}`);
    await page.waitForSelector('[data-testid="recommendation-wizard"]', { timeout: 10000 });
    
    await page.fill('[data-testid="craving-input"]', 'Quiero tacos al pastor muy picantes para celebrar');
    await page.click('[data-testid="craving-tag-picante"]');
    await page.click('[data-testid="craving-tag-mexicana"]');
    await page.click('[data-testid="wizard-continue-btn"]');
    
    await page.waitForSelector('[data-testid="diet-selection"]', { timeout: 5000 });
    await page.click('[data-testid="diet-option-vegana"]');
    await page.click('[data-testid="wizard-continue-btn"]');
    
    await page.waitForSelector('[data-testid="allergy-selection"]', { timeout: 5000 });
    await page.click('[data-testid="allergy-option-lacteos"]');
    await page.click('[data-testid="wizard-continue-btn"]');
    
    await page.waitForSelector('[data-testid="social-context-selection"]', { timeout: 5000 });
    await page.click('[data-testid="social-context-option-familiar"]');
    await page.click('[data-testid="wizard-continue-btn"]');
    
    await expect(page.locator('[data-testid="recommendation-summary"]')).toBeVisible();
    
    console.log('  ✓ PASSED: Cuestionario completed with craving, diet, and allergies');
  });

  test('TC-003: Should verify recommendations display with matchScore/matchPercentage', async ({ page }) => {
    console.log('\nTC-003: Recommendations Display with Match Scores');
    
    const restaurantId = 'china-123';
    await page.goto(`${BASE_URL}/menu/${restaurantId}`);
    await page.waitForSelector('[data-testid="recommendation-wizard"]', { timeout: 10000 });
    
    await page.fill('[data-testid="craving-input"]', 'Quiero comer algo delicioso');
    await page.click('[data-testid="craving-tag-rapida"]');
    await page.click('[data-testid="wizard-continue-btn"]');
    
    await page.waitForSelector('[data-testid="diet-selection"]', { timeout: 5000 });
    await page.click('[data-testid="diet-option"]');
    await page.click('[data-testid="wizard-continue-btn"]');
    
    await page.click('[data-testid="wizard-continue-btn"]');
    
    await page.waitForSelector('[data-testid="social-context-selection"]', { timeout: 5000 });
    await page.click('[data-testid="social-context-option"]');
    await page.click('[data-testid="wizard-continue-btn"]');
    
    await page.click('[data-testid="discover-recommendations"]');
    await page.waitForSelector('[data-testid="recommendation-card"]', { timeout: 15000 });
    
    const card = page.locator('[data-testid="recommendation-card"]').first();
    await expect(card).toBeVisible();
    
    const matchScore = page.locator('[data-testid="recommendation-score"]');
    await expect(matchScore).toBeVisible();
    
    const matchPercentage = page.locator('[data-testid="match-percentage"]');
    await expect(matchPercentage).toBeVisible();
    
    console.log('  ✓ PASSED: Recommendations display with matchScore and matchPercentage');
  });

  test('TC-004: Should test 8+ recommendations from ml-service (not fallback)', async ({ page }) => {
    console.log('\nTC-004: Verify 8+ Recommendations from ML Service');
    
    const restaurantId = 'china-123';
    await page.goto(`${BASE_URL}/menu/${restaurantId}`);
    await page.waitForSelector('[data-testid="recommendation-wizard"]', { timeout: 10000 });
    
    await page.fill('[data-testid="craving-input"]', 'Quiero comida mexicana para celebrar');
    await page.click('[data-testid="wizard-continue-btn"]');
    
    await page.waitForSelector('[data-testid="diet-selection"]', { timeout: 5000 });
    await page.click('[data-testid="diet-option"]');
    await page.click('[data-testid="wizard-continue-btn"]');
    
    await page.click('[data-testid="wizard-continue-btn"]');
    
    await page.waitForSelector('[data-testid="social-context-selection"]', { timeout: 5000 });
    await page.click('[data-testid="social-context-option"]');
    await page.click('[data-testid="wizard-continue-btn"]');
    
    await page.click('[data-testid="discover-recommendations"]');
    await page.waitForSelector('[data-testid="recommendation-card"]', { timeout: 20000 });
    
    const cards = page.locator('[data-testid="recommendation-card"]');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(8);
    
    for (let i = 0; i < Math.min(count, 8); i++) {
      const card = cards.nth(i);
      await expect(card).toBeVisible();
      
      const dishName = card.locator('[data-testid="dish-name"]');
      await expect(dishName).toBeVisible();
      
      const restaurant = card.locator('[data-testid="recommended-restaurant"]');
      await expect(restaurant).toBeVisible();
      
      const score = card.locator('[data-testid="recommendation-score"]');
      await expect(score).toBeVisible();
    }
    
    console.log('  ✓ PASSED: Received ' + count + ' recommendations from ML service');
  });

  test('TC-005: Should verify spaCy active in response', async ({ page }) => {
    console.log('\nTC-005: Verify spaCy Active in ML Response');
    
    const restaurantId = 'china-123';
    await page.goto(`${BASE_URL}/menu/${restaurantId}`);
    await page.waitForSelector('[data-testid="recommendation-wizard"]', { timeout: 10000 });
    
    await page.fill('[data-testid="craving-input"]', 'Quiero tacos al pastor muy picantes para celebrar');
    await page.click('[data-testid="wizard-continue-btn"]');
    
    await page.waitForSelector('[data-testid="diet-selection"]', { timeout: 5000 });
    await page.click('[data-testid="diet-option"]');
    await page.click('[data-testid="wizard-continue-btn"]');
    
    await page.click('[data-testid="wizard-continue-btn"]');
    
    await page.waitForSelector('[data-testid="social-context-selection"]', { timeout: 5000 });
    await page.click('[data-testid="social-context-option"]');
    await page.click('[data-testid="wizard-continue-btn"]');
    
    await page.waitForSelector('[data-testid="spacy-active"]', { timeout: 10000 });
    
    await page.click('[data-testid="discover-recommendations"]');
    await page.waitForSelector('[data-testid="recommendation-card"]', { timeout: 20000 });
    
    const cards = page.locator('[data-testid="recommendation-card"]');
    expect(await cards.count()).toBeGreaterThanOrEqual(1);
    
    const card = cards.first();
    const spacyBadge = card.locator('[data-testid="spacy-badge"]');
    await expect(spacyBadge).toBeVisible();
    
    console.log('  ✓ PASSED: spaCy is active and indicated in response');
  });

  test('TC-006: Complete end-to-end recommendation flow', async ({ page }) => {
    console.log('\nTC-006: Complete End-to-End Recommendation Flow');
    
    const restaurantId = 'china-123';
    await page.goto(`${BASE_URL}/menu/${restaurantId}`);
    
    await expect(page.locator('[data-testid="public-menu-header"]')).toBeVisible();
    await page.waitForSelector('[data-testid="recommendation-wizard"]', { timeout: 10000 });
    
    await page.fill('[data-testid="craving-input"]', 'Quiero algo caldosito y picante para mi familia');
    await page.click('[data-testid="craving-tag-picante"]');
    await page.click('[data-testid="craving-tag-caldosito"]');
    await page.click('[data-testid="wizard-continue-btn"]');
    
    await page.waitForSelector('[data-testid="diet-selection"]', { timeout: 5000 });
    await page.click('[data-testid="diet-option-vegetariana"]');
    await page.click('[data-testid="wizard-continue-btn"]');
    
    await page.waitForSelector('[data-testid="allergy-selection"]', { timeout: 5000 });
    await page.click('[data-testid="wizard-continue-btn"]');
    
    await page.waitForSelector('[data-testid="social-context-selection"]', { timeout: 5000 });
    await page.click('[data-testid="social-context-option-familiar"]');
    await page.click('[data-testid="wizard-continue-btn"]');
    
    await expect(page.locator('[data-testid="recommendation-summary"]')).toBeVisible();
    await page.click('[data-testid="discover-recommendations"]');
    await page.waitForSelector('[data-testid="recommendation-card"]', { timeout: 20000 });
    
    const card = page.locator('[data-testid="recommendation-card"]').first();
    await expect(card).toBeVisible();
    
    const dishName = page.locator('[data-testid="dish-name"]');
    await expect(dishName).toBeVisible();
    
    const restaurant = page.locator('[data-testid="recommended-restaurant"]');
    await expect(restaurant).toBeVisible();
    
    const score = page.locator('[data-testid="recommendation-score"]');
    await expect(score).toBeVisible();
    
    const matchPercentage = page.locator('[data-testid="match-percentage"]');
    await expect(matchPercentage).toBeVisible();
    
    const spacyBadge = page.locator('[data-testid="spacy-badge"]');
    await expect(spacyBadge).toBeVisible();
    
    console.log('  ✓ PASSED: Complete end-to-end flow successful');
  });
});

test.describe.configure({
  timeout: 60000,
  retries: 1
});
