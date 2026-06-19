import { test, expect } from '@playwright/test';

test.describe('User Profile', () => {
  test.beforeEach(async ({ page, context }) => {
    // Mock profile data
    await context.route('**/api/users/1', (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          user: {
            id: 1,
            email: 'john@example.com',
            is_admin: false,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z'
          },
          profile: {
            id: 1,
            user_id: 1,
            first_name: 'John',
            last_name: 'Doe',
            nickname_school: 'Johnny',
            bio: 'Software engineer from 2010',
            then_photo_url: 'https://example.com/then.jpg',
            now_photo_url: 'https://example.com/now.jpg',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z'
          }
        })
      });
    });

    await page.goto('/profile');
  });

  test('should display profile information', async ({ page }) => {
    // Wait for profile to load
    await expect(page.locator('text=John Doe')).toBeVisible();
    await expect(page.locator('text=john@example.com')).toBeVisible();
    await expect(page.locator('text=Johnny')).toBeVisible();
    await expect(page.locator('text=Software engineer from 2010')).toBeVisible();
  });

  test('should display profile sections', async ({ page }) => {
    // Personal Information section
    await expect(page.locator('text=Personal Information')).toBeVisible();

    // Photos section
    await expect(page.locator('text=Photos')).toBeVisible();

    // Account Info section
    await expect(page.locator('text=Account Info')).toBeVisible();
  });

  test('should have Edit Profile button', async ({ page }) => {
    const editButton = page.locator('button:has-text("Edit Profile")');
    await expect(editButton).toBeVisible();
    await expect(editButton).toBeEnabled();
  });

  test('should toggle edit mode', async ({ page }) => {
    const editButton = page.locator('button:has-text("Edit Profile")');

    // Click to enter edit mode
    await editButton.click();

    // Should show Cancel button instead
    await expect(page.locator('button:has-text("Cancel")')).toBeVisible();

    // Should show input fields
    await expect(page.locator('input[value="John"]')).toBeVisible();
    await expect(page.locator('input[value="Doe"]')).toBeVisible();
  });

  test('should allow editing profile fields', async ({ page }) => {
    const editButton = page.locator('button:has-text("Edit Profile")');
    await editButton.click();

    // Edit first name
    const firstNameInput = page.locator('input[value="John"]');
    await firstNameInput.clear();
    await firstNameInput.fill('Jane');
    await expect(firstNameInput).toHaveValue('Jane');

    // Edit last name
    const lastNameInput = page.locator('input[value="Doe"]');
    await lastNameInput.clear();
    await lastNameInput.fill('Smith');
    await expect(lastNameInput).toHaveValue('Smith');
  });

  test('should cancel edit mode', async ({ page }) => {
    const editButton = page.locator('button:has-text("Edit Profile")');
    await editButton.click();

    // Edit a field
    const firstNameInput = page.locator('input[value="John"]');
    await firstNameInput.clear();
    await firstNameInput.fill('Jane');

    // Click Cancel
    const cancelButton = page.locator('button:has-text("Cancel")');
    await cancelButton.click();

    // Should exit edit mode and revert changes
    await expect(page.locator('text=John Doe')).toBeVisible();
    await expect(firstNameInput).not.toBeVisible();
  });

  test('should display photos', async ({ page }) => {
    // Check for photo images
    await expect(page.locator('img[alt="Then"]')).toBeVisible();
    await expect(page.locator('img[alt="Now"]')).toBeVisible();

    // Photos should have proper src
    const thenPhoto = page.locator('img[alt="Then"]');
    await expect(thenPhoto).toHaveAttribute('src', 'https://example.com/then.jpg');

    const nowPhoto = page.locator('img[alt="Now"]');
    await expect(nowPhoto).toHaveAttribute('src', 'https://example.com/now.jpg');
  });

  test('should have file input for photo upload', async ({ page }) => {
    // Check for file inputs
    const fileInputs = page.locator('input[type="file"]');
    const count = await fileInputs.count();
    expect(count).toBeGreaterThanOrEqual(2);

    // Check for upload buttons
    await expect(page.locator('span:has-text("Choose File")')).toHaveCount(2);
  });

  test('should display account creation date', async ({ page }) => {
    const date = new Date('2024-01-01').toLocaleDateString();
    await expect(page.locator(`text=${date}`)).toBeVisible();
  });

  test('should display admin status', async ({ page }) => {
    await expect(page.locator('text=Regular User')).toBeVisible();
  });

  test('should have proper responsive layout', async ({ page }) => {
    // Test desktop layout
    await page.setViewportSize({ width: 1920, height: 1080 });
    let sections = page.locator('div[style*="background"]');
    expect(await sections.count()).toBeGreaterThan(0);

    // Test mobile layout
    await page.setViewportSize({ width: 375, height: 667 });
    sections = page.locator('div[style*="background"]');
    expect(await sections.count()).toBeGreaterThan(0);
  });

  test('should display user email in profile', async ({ page }) => {
    await expect(page.locator('text=john@example.com')).toBeVisible();
  });

  test('should handle loading state', async ({ page }) => {
    // Navigate to profile page
    await page.goto('/profile');

    // Should eventually show profile content
    await expect(page.locator('text=John Doe')).toBeVisible({ timeout: 5000 });
  });
});
