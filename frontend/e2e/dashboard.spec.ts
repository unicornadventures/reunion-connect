import { test, expect } from '@playwright/test';

test.describe('Dashboard Navigation', () => {
  test.beforeEach(async ({ page, context }) => {
    // Mock successful login
    await context.route('**/api/auth/me', (route) => {
      route.continue();
    });

    await page.goto('/');

    // Fill login form
    await page.locator('input[placeholder="Enter your email"]').fill('test@example.com');
    await page.locator('input[placeholder="Enter your password"]').fill('password123');

    // Mock the login API response
    await context.route('**/api/auth/login', (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          id: 1,
          email: 'test@example.com',
          is_admin: false,
          created_at: '2024-01-01T00:00:00Z',
          profile: {
            first_name: 'John',
            last_name: 'Doe',
            nickname_school: 'Johnny',
            bio: 'Software engineer',
            then_photo_url: null,
            now_photo_url: null
          },
          token: 'fake-jwt-token'
        })
      });
    });

    await page.locator('button:has-text("Log In")').click();
  });

  test('should display navigation menu after login', async ({ page }) => {
    // Navigation should be visible
    await expect(page.locator('a:has-text("Dashboard")')).toBeVisible();
    await expect(page.locator('a:has-text("Schools")')).toBeVisible();
    await expect(page.locator('a:has-text("Classes")')).toBeVisible();
    await expect(page.locator('a:has-text("Profile")')).toBeVisible();
    await expect(page.locator('a:has-text("Comments")')).toBeVisible();
  });

  test('should navigate to profile page', async ({ page }) => {
    await page.locator('a:has-text("Profile")').click();
    await expect(page.locator('text=Profile')).toBeVisible();
  });

  test('should navigate to schools page', async ({ page }) => {
    await page.locator('a:has-text("Schools")').click();
    await expect(page.locator('text=School')).toBeVisible();
  });

  test('should navigate to classes page', async ({ page }) => {
    await page.locator('a:has-text("Classes")').click();
    await expect(page.locator('text=Class')).toBeVisible();
  });

  test('should navigate to comments page', async ({ page }) => {
    await page.locator('a:has-text("Comments")').click();
    await expect(page.locator('text=Comments')).toBeVisible();
  });

  test('should have working logout button', async ({ page }) => {
    // Logout button should be visible
    const logoutButton = page.locator('button:has-text("Logout")');
    await expect(logoutButton).toBeVisible();

    // Click logout
    await logoutButton.click();

    // Should redirect to login
    await expect(page.locator('text=Class Reunion')).toBeVisible();
    await expect(page.locator('input[placeholder="Enter your email"]')).toBeVisible();
  });

  test('should display user name in dashboard', async ({ page }) => {
    await expect(page.locator('text=Welcome, John!')).toBeVisible();
    await expect(page.locator('text=Logout (John)')).toBeVisible();
  });

  test('should have proper styling for navigation', async ({ page }) => {
    const dashboardLink = page.locator('a:has-text("Dashboard")');

    // Dashboard link should have special styling (bold, green color)
    const style = await dashboardLink.evaluate((el) => ({
      fontWeight: window.getComputedStyle(el).fontWeight,
      color: window.getComputedStyle(el).color
    }));

    // Should have bold font weight
    expect(['700', 'bold']).toContain(style.fontWeight);
  });
});
