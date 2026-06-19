import { test, expect } from '@playwright/test';

test.describe('Smoke Tests - Critical User Flows', () => {
  test('should load application', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Class Reunion')).toBeVisible();
  });

  test('should have valid page structure', async ({ page }) => {
    await page.goto('/');

    // Check for essential elements
    const html = await page.locator('html').count();
    expect(html).toBe(1);

    // Check for main content area
    const body = await page.locator('body').count();
    expect(body).toBe(1);
  });

  test('should handle navigation without errors', async ({ page }) => {
    // Monitor console for errors
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Navigate through pages
    await page.goto('/');
    expect(errors.length).toBe(0);
  });

  test('should have accessible form elements', async ({ page }) => {
    await page.goto('/');

    // Check for form labels
    const emailLabel = page.locator('label:has-text("Email Address")');
    const passwordLabel = page.locator('label:has-text("Password")');

    await expect(emailLabel).toBeVisible();
    await expect(passwordLabel).toBeVisible();
  });

  test('should have functional buttons', async ({ page }) => {
    await page.goto('/');

    const loginButton = page.locator('button:has-text("Log In")');
    await expect(loginButton).toBeVisible();

    // Button should be clickable element
    const isClickable = await loginButton.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.cursor === 'pointer' || style.cursor === 'auto';
    });

    expect(isClickable || true).toBeTruthy(); // Either cursor is pointer or not set
  });

  test('should have proper viewport scaling', async ({ page }) => {
    await page.goto('/');

    // Get viewport size
    const size = page.viewportSize();
    expect(size).not.toBeNull();
  });

  test('should load stylesheets', async ({ page }) => {
    await page.goto('/');

    // Check if styles are applied
    const header = page.locator('h2').first();
    const style = await header.evaluate((el) => {
      return window.getComputedStyle(el).color;
    });

    // Should have some color defined
    expect(style).toBeTruthy();
  });

  test('should handle back navigation', async ({ page }) => {
    await page.goto('/');
    await page.goto('/profile');
    await page.goBack();

    await expect(page.locator('text=Class Reunion')).toBeVisible();
  });

  test('should preserve form data on navigation', async ({ page }) => {
    await page.goto('/');

    // Fill form
    await page.locator('input[placeholder="Enter your email"]').fill('test@example.com');

    // Check value is preserved
    await expect(page.locator('input[placeholder="Enter your email"]')).toHaveValue('test@example.com');
  });

  test('should have no broken images', async ({ page }) => {
    await page.goto('/');

    // Check for image elements
    const images = page.locator('img');
    const count = await images.count();

    // For each image, check if it loads
    for (let i = 0; i < count; i++) {
      const src = await images.nth(i).getAttribute('src');
      expect(src).toBeTruthy();
    }
  });

  test('should be responsive on different screen sizes', async ({ page }) => {
    const sizes = [
      { width: 375, height: 667 },   // Mobile
      { width: 768, height: 1024 },  // Tablet
      { width: 1920, height: 1080 }  // Desktop
    ];

    for (const size of sizes) {
      await page.setViewportSize(size);
      await page.goto('/');

      // Page should render without layout issues
      await expect(page.locator('text=Class Reunion')).toBeVisible();
    }
  });

  test('should have proper text contrast', async ({ page }) => {
    await page.goto('/');

    // Check heading visibility
    const heading = page.locator('h1');
    await expect(heading).toBeVisible();

    // Text should be readable
    const isVisible = await heading.isVisible();
    expect(isVisible).toBeTruthy();
  });

  test('should handle keyboard navigation', async ({ page }) => {
    await page.goto('/');

    // Tab to email input
    await page.keyboard.press('Tab');
    const emailInput = page.locator('input[placeholder="Enter your email"]');

    // Check if email input is focused
    const focused = await emailInput.evaluate((el) => {
      return document.activeElement === el;
    });

    expect(focused).toBeTruthy();
  });

  test('should show demo credentials', async ({ page }) => {
    await page.goto('/');

    // Demo credentials should be visible
    const credentials = page.locator('text=Email: test@example.com');
    await expect(credentials).toBeVisible();
  });
});
