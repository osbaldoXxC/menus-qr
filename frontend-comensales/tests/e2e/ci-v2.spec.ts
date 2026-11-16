import { test, expect } from '@playwright/test';

test('comensal busca texto libre y recibe un platillo real del catálogo sintético', async ({ page }) => {
  await page.goto('/descubrir');
  await page.getByLabel('Tu antojo').fill('Quiero un taco');
  const responsePromise = page.waitForResponse(response => response.request().method() === 'POST' && response.url().includes('/recommendations'));
  await page.getByRole('button', { name: 'Buscar platillos' }).click();
  const response = await responsePromise;
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.meta.mlUsed).toBe(true);
  expect(body.recommendations.some((item: { dish: { name: string } }) => item.dish.name === 'Taco sintetico')).toBe(true);
  await expect(page.getByTestId('recommendation-card')).toContainText('Taco sintetico');
});

test('una exclusión sin evidencia muestra ausencia verificable, no un platillo inseguro', async ({ page }) => {
  await page.goto('/descubrir');
  await page.getByLabel('Tu antojo').fill('Quiero algo que no lleve leche');
  const responsePromise = page.waitForResponse(response => response.request().method() === 'POST' && response.url().includes('/recommendations'));
  await page.getByRole('button', { name: 'Buscar platillos' }).click();
  const response = await responsePromise;
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.status.code).toBe('no_verified_results');
  expect(body.recommendations).toEqual([]);
  await expect(page.getByRole('heading', { name: 'Sin resultados verificables' })).toBeVisible();
});
