import { test, expect } from '@playwright/test';

const restaurantUrl = process.env.CI_RESTAURANT_URL || 'http://127.0.0.1:43011';
const adminUrl = process.env.CI_ADMIN_URL || 'http://127.0.0.1:43012';
const password = 'Synthetic-only-123!';

test('restaurante inicia sesión y consulta su menú sintético', async ({ page }) => {
  await page.goto(`${restaurantUrl}/login`);
  await page.getByPlaceholder('Correo electrónico').fill('uno@example.invalid');
  await page.getByPlaceholder('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/dashboard\/restaurante/);
  await page.goto(`${restaurantUrl}/dashboard/platillos`);
  await expect(page.getByText('Taco sintetico').first()).toBeVisible();
});

test('superadmin inicia sesión y accede al panel', async ({ page }) => {
  await page.goto(adminUrl);
  await page.locator('input[type="email"]').fill('admin-ci@example.invalid');
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: 'Ingresar al sistema' }).click();
  await expect(page.getByText('Prueba Uno').first()).toBeVisible();
  await page.getByRole('button', { name: 'Soporte Premium' }).click();
  await expect(page.getByRole('heading', { name: 'Soporte', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Métricas' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard de Soporte' })).toBeVisible();
});

test('cuenta de restaurante no puede entrar al panel de superadmin', async ({ page }) => {
  await page.goto(adminUrl);
  await page.locator('input[type="email"]').fill('uno@example.invalid');
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: 'Ingresar al sistema' }).click();
  await expect(page.getByText(/Acceso denegado/)).toBeVisible();
});
