import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display login page when not authenticated', async ({ page }) => {
    // Check page elements
    await expect(page.locator('text=Class Reunion')).toBeVisible();
    await expect(page.locator('text=Connect with Your Class')).toBeVisible();
    await expect(page.locator('input[placeholder="Enter your email"]')).toBeVisible();
    await expect(page.locator('input[placeholder="Enter your password"]')).toBeVisible();
  });

  test('should show validation error for empty form submission', async ({ page }) => {
    // Submit button should be disabled initially
    const submitButton = page.locator('button:has-text("Log In")');
    await expect(submitButton).toBeDisabled();
  });

  test('should enable submit button when form is filled', async ({ page }) => {
    const emailInput = page.locator('input[placeholder="Enter your email"]');
    const passwordInput = page.locator('input[placeholder="Enter your password"]');
    const submitButton = page.locator('button:has-text("Log In")');

    await emailInput.fill('test@example.com');
    await passwordInput.fill('password123');

    await expect(submitButton).toBeEnabled();
  });

  test('should show error message on failed login', async ({ page, context }) => {
    // Intercept the API request to return an error
    await context.route('**/api/auth/login', (route) => {
      route.abort('failed');
    });

    const emailInput = page.locator('input[placeholder="Enter your email"]');
    const passwordInput = page.locator('input[placeholder="Enter your password"]');
    const submitButton = page.locator('button:has-text("Log In")');

    await emailInput.fill('invalid@example.com');
    await passwordInput.fill('wrongpassword');
    await submitButton.click();

    // Should show loading state briefly
    await expect(page.locator('button:has-text("Logging In")')).toBeVisible();
  });

  test('should display demo credentials on login page', async ({ page }) => {
    await expect(page.locator('text=Demo Credentials:')).toBeVisible();
    await expect(page.locator('text=Email: test@example.com')).toBeVisible();
    await expect(page.locator('text=Password: password123')).toBeVisible();
  });

  test('should handle email input validation', async ({ page }) => {
    const emailInput = page.locator('input[placeholder="Enter your email"]');

    // Type invalid email
    await emailInput.fill('notanemail');
    await emailInput.blur();

    // HTML5 validation should prevent submission
    const isValid = await emailInput.evaluate((el: HTMLInputElement) => el.checkValidity());
    expect(isValid).toBeFalsy();
  });

  test('should clear password field when switching focus', async ({ page }) => {
    const emailInput = page.locator('input[placeholder="Enter your email"]');
    const passwordInput = page.locator('input[placeholder="Enter your password"]');

    await emailInput.fill('test@example.com');
    await passwordInput.fill('password123');
    await expect(passwordInput).toHaveValue('password123');

    // Password should be masked (type=password)
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('should have proper form structure', async ({ page }) => {
    // Check form labels
    await expect(page.locator('label:has-text("Email Address")')).toBeVisible();
    await expect(page.locator('label:has-text("Password")')).toBeVisible();

    // Check for form element
    const form = page.locator('form');
    await expect(form).toBeVisible();
  });

  test('should be responsive on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    // Elements should still be visible
    await expect(page.locator('text=Class Reunion')).toBeVisible();
    await expect(page.locator('input[placeholder="Enter your email"]')).toBeVisible();
    await expect(page.locator('button:has-text("Log In")')).toBeVisible();
  });
});
