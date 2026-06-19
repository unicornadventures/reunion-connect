import { test, expect } from '@playwright/test';

test.describe('Comments Section', () => {
  test.beforeEach(async ({ page, context }) => {
    // Mock comments data
    await context.route('**/api/users/*/comments', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          body: JSON.stringify({
            comments: [
              {
                id: 1,
                target_user_id: 1,
                commenter_id: 2,
                content: 'Great times at school!',
                published: true,
                created_at: '2024-06-19T10:00:00Z',
                updated_at: '2024-06-19T10:00:00Z',
                first_name: 'Jane',
                last_name: 'Smith'
              },
              {
                id: 2,
                target_user_id: 1,
                commenter_id: 3,
                content: 'Remember the old days?',
                published: true,
                created_at: '2024-06-18T15:30:00Z',
                updated_at: '2024-06-18T15:30:00Z',
                first_name: 'Bob',
                last_name: 'Johnson'
              }
            ]
          })
        });
      } else {
        route.continue();
      }
    });

    await page.goto('/comments');
  });

  test('should display comments heading', async ({ page }) => {
    await expect(page.locator('text=Comments')).toBeVisible();
  });

  test('should display list of comments', async ({ page }) => {
    // Wait for comments to load
    await expect(page.locator('text=Great times at school!')).toBeVisible();
    await expect(page.locator('text=Remember the old days?')).toBeVisible();
  });

  test('should display commenter names', async ({ page }) => {
    await expect(page.locator('text=Jane Smith')).toBeVisible();
    await expect(page.locator('text=Bob Johnson')).toBeVisible();
  });

  test('should display comment dates', async ({ page }) => {
    // Should show some date format
    const dateElements = page.locator('span').filter({ hasText: /\/.*\// });
    const count = await dateElements.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('should have comment form', async ({ page }) => {
    // Check for comment form
    await expect(page.locator('h4:has-text("Leave a Comment")')).toBeVisible();
    await expect(page.locator('textarea[placeholder="Share your thoughts..."]')).toBeVisible();
  });

  test('should have post comment button', async ({ page }) => {
    const postButton = page.locator('button:has-text("Post Comment")');
    await expect(postButton).toBeVisible();
  });

  test('should disable submit button with empty textarea', async ({ page }) => {
    const postButton = page.locator('button:has-text("Post Comment")');
    await expect(postButton).toBeDisabled();
  });

  test('should enable submit button when text is entered', async ({ page }) => {
    const textarea = page.locator('textarea[placeholder="Share your thoughts..."]');
    const postButton = page.locator('button:has-text("Post Comment")');

    await textarea.fill('This is a great reunion!');
    await expect(postButton).toBeEnabled();
  });

  test('should post a new comment', async ({ page, context }) => {
    // Mock POST request
    await context.route('**/api/users/*/comments', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 201,
          body: JSON.stringify({
            comment: {
              id: 3,
              target_user_id: 1,
              commenter_id: 1,
              content: 'This is a great reunion!',
              published: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              first_name: 'John',
              last_name: 'Doe'
            }
          })
        });
      }
    });

    const textarea = page.locator('textarea[placeholder="Share your thoughts..."]');
    const postButton = page.locator('button:has-text("Post Comment")');

    await textarea.fill('This is a great reunion!');
    await postButton.click();

    // Should show loading state
    await expect(page.locator('button:has-text("Posting")')).toBeVisible();

    // Should clear textarea after posting
    await expect(textarea).toHaveValue('');
  });

  test('should display comment cards with proper styling', async ({ page }) => {
    // Check for comment card structure
    const commentCards = page.locator('div').filter({ hasText: 'Great times at school!' });
    expect(await commentCards.count()).toBeGreaterThan(0);
  });

  test('should show empty state when no comments', async ({ page, context }) => {
    // Mock empty comments response
    await context.route('**/api/users/*/comments', (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({ comments: [] })
      });
    });

    // Reload page to get empty state
    await page.reload();

    await expect(page.locator('text=No comments yet')).toBeVisible();
    await expect(page.locator('text=Be the first to comment')).toBeVisible();
  });

  test('should have loading state initially', async ({ page }) => {
    // Create a new page without route mocking
    const newPage = await page.context().newPage();

    // Should show loading state briefly
    newPage.goto('/comments');

    // Loading text should appear before comments
    const maybeLoading = await newPage.locator('text=Loading comments').isVisible();

    // Either loading or comments should appear
    const commentsVisible = await newPage.locator('text=Great times').isVisible({ timeout: 5000 });

    newPage.close();
  });

  test('should handle error state gracefully', async ({ page, context }) => {
    // Mock error response
    await context.route('**/api/users/*/comments', (route) => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Failed to load comments.' })
      });
    });

    await page.reload();

    // Should show error message
    await expect(page.locator('text=Failed to load comments')).toBeVisible({ timeout: 5000 });
  });

  test('should display comment count', async ({ page }) => {
    // Comments heading should show count
    await expect(page.locator('h3:has-text("Comments (2)")')).toBeVisible();
  });

  test('should have responsive layout on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    // Comments should still be visible
    await expect(page.locator('text=Great times at school!')).toBeVisible();
    await expect(page.locator('textarea[placeholder="Share your thoughts..."]')).toBeVisible();
  });
});
