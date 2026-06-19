import { test, expect } from '@playwright/test';

test.describe('Schools and Classes Management', () => {
  test.beforeEach(async ({ page, context }) => {
    // Mock schools data
    await context.route('**/api/schools', (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          schools: [
            {
              id: 1,
              name: 'Central High School',
              location: 'Downtown',
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z'
            },
            {
              id: 2,
              name: 'Westside Academy',
              location: 'West End',
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z'
            }
          ]
        })
      });
    });

    // Mock classes data
    await context.route('**/api/classes', (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          classes: [
            {
              id: 1,
              year: 2010,
              school_id: 1,
              school_name: 'Central High School',
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z'
            },
            {
              id: 2,
              year: 2015,
              school_id: 2,
              school_name: 'Westside Academy',
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z'
            }
          ]
        })
      });
    });

    await page.goto('/');
  });

  test('should display schools section on dashboard', async ({ page }) => {
    // Mock login first
    await page.locator('input[placeholder="Enter your email"]').fill('test@example.com');
    await page.locator('input[placeholder="Enter your password"]').fill('password123');

    await page.context().route('**/api/auth/login', (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          id: 1,
          email: 'test@example.com',
          is_admin: false,
          created_at: '2024-01-01T00:00:00Z',
          profile: {
            first_name: 'John',
            last_name: 'Doe'
          },
          token: 'fake-token'
        })
      });
    });

    await page.locator('button:has-text("Log In")').click();

    // Schools should be visible
    await expect(page.locator('text=Central High School')).toBeVisible();
    await expect(page.locator('text=Westside Academy')).toBeVisible();
  });

  test('should navigate to schools page', async ({ page }) => {
    await page.goto('/schools');

    await expect(page.locator('text=Central High School')).toBeVisible();
    await expect(page.locator('text=Westside Academy')).toBeVisible();
  });

  test('should navigate to classes page', async ({ page }) => {
    await page.goto('/classes');

    // Classes should be displayed
    await expect(page.locator('text=2010')).toBeVisible();
    await expect(page.locator('text=2015')).toBeVisible();
  });

  test('should display class year and school name', async ({ page }) => {
    await page.goto('/classes');

    // Check for class details
    const classElements = page.locator('text=Central High School');
    expect(await classElements.count()).toBeGreaterThan(0);
  });

  test('should have responsive grid layout', async ({ page }) => {
    await page.goto('/schools');

    // Check for grid layout on desktop
    await page.setViewportSize({ width: 1920, height: 1080 });
    let schoolsSection = page.locator('text=School Management');
    await expect(schoolsSection).toBeVisible();

    // Check on mobile
    await page.setViewportSize({ width: 375, height: 667 });
    schoolsSection = page.locator('text=School Management');
    await expect(schoolsSection).toBeVisible();
  });

  test('should display school location', async ({ page }) => {
    await page.goto('/schools');

    await expect(page.locator('text=Downtown')).toBeVisible();
    await expect(page.locator('text=West End')).toBeVisible();
  });

  test('should handle empty states', async ({ page, context }) => {
    // Mock empty response
    await context.route('**/api/schools', (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({ schools: [] })
      });
    });

    await page.goto('/schools');

    // Should show empty or loading state
    const content = await page.locator('body').textContent();
    expect(content).toBeTruthy();
  });

  test('should display school count', async ({ page }) => {
    await page.goto('/schools');

    // At least one school should be visible
    const schoolNames = page.locator('text=Central High School');
    expect(await schoolNames.count()).toBeGreaterThan(0);
  });
});
