# Playwright E2E Tests

Comprehensive end-to-end tests for the Class Reunion frontend using Playwright.

## Setup

```bash
npm install
npx playwright install  # Install browser binaries
```

## Running Tests

### Development
```bash
npm run test:e2e         # Run all tests
npm run test:e2e:ui      # Run with UI mode (interactive)
npm run test:e2e:debug   # Run in debug mode
```

### CI/CD
Tests run on multiple browsers (Chromium, Firefox, WebKit) and mobile viewports.

```bash
CI=true npm run test:e2e
```

## Test Structure

### `auth.spec.ts`
- Login page rendering
- Form validation
- Empty state handling
- Error messages
- Mobile responsiveness

### `dashboard.spec.ts`
- Navigation menu
- Page navigation
- Logout functionality
- User greeting display
- Navigation styling

### `profile.spec.ts`
- Profile information display
- Edit mode toggle
- Field editing
- Photo display
- Account info section
- Responsive layout

### `comments.spec.ts`
- Comment list rendering
- Comment creation
- Commenter information
- Comment dates
- Empty states
- Error handling
- Mobile responsiveness

### `schools-classes.spec.ts`
- Schools listing
- Classes listing
- School details
- Class details
- Grid layout responsiveness

### `directory.spec.ts`
- Class header (school + year) and classmate count
- Former name / initials displayed when set, falling back to current name
- Deceased classmates shown in a separate "In Memoriam" section
- Sort order (mirrors the backend's sort by former-then-current last name)
- Search matching former first/last name, current name, email, and tags
- Empty states (no search matches, empty class)
- Navigation to a classmate's profile on card click
- API error handling

> **Note:** `auth.spec.ts`, `dashboard.spec.ts`, `profile.spec.ts`, `comments.spec.ts`, and
> `schools-classes.spec.ts` predate the `e2e/helpers/auth.ts` helper and don't seed an
> authenticated session before navigating — as written they redirect to `/login` and fail.
> Use `directory.spec.ts` as the reference for the working pattern (see "Authentication" below)
> if you fix or rewrite them.

### `smoke.spec.ts`
- Critical user flows
- Page loading
- Navigation
- Form interaction
- Accessibility
- Responsive design
- Keyboard navigation

## Configuration

See `playwright.config.ts` for:
- Test directory: `./e2e`
- Base URL: `http://localhost:5173`
- Browsers: Chromium, Firefox, WebKit
- Mobile: Pixel 5
- Screenshots: Only on failure
- Traces: On first retry

## Key Features

✅ **Multi-browser testing** - Chromium, Firefox, WebKit
✅ **Mobile testing** - Pixel 5 viewport
✅ **Accessibility checks** - Keyboard navigation, contrast
✅ **Visual testing** - Screenshots on failure
✅ **Trace recording** - Debug failed tests
✅ **API mocking** - Mock backend responses
✅ **Responsive design** - Test multiple viewports
✅ **Error handling** - Network failures, validation

## Writing New Tests

### Authentication

Most routes require a logged-in session, and `AppContext` only reads `localStorage` once, on
mount. Seed the session with `page.addInitScript` *before* `page.goto`, via the `loginAs` helper
in `e2e/helpers/auth.ts` — `page.evaluate` after navigation is too late:

```typescript
import { loginAs } from './helpers/auth';

test.beforeEach(async ({ page }) => {
  await loginAs(page, { id: 1, email: 'me@example.com', profile: { first_name: 'Jane', last_name: 'Doe' } });
});
```

### Test Template
```typescript
import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page, context }) => {
    await loginAs(page, { id: 1, email: 'me@example.com' });
    // Setup: mock APIs, etc.
    await page.goto('/');
  });

  test('should do something', async ({ page }) => {
    // Arrange: Set up state
    await page.locator('selector').fill('value');

    // Act: Perform action
    await page.locator('button').click();

    // Assert: Verify result
    await expect(page.locator('result')).toBeVisible();
  });
});
```

### A note on non-retrying locator methods

`allTextContents()`, `innerHTML()`, `count()`, etc. read the DOM once and don't wait for content
to appear the way `expect(locator).toBeVisible()` does. If the data loads asynchronously (as the
directory does), assert on a retrying matcher first (e.g. `await expect(locator).toHaveCount(n)`)
before calling one of these, or it will race the fetch and silently return an empty result.

### Best Practices

1. **Use page objects** - Avoid repetitive selectors
2. **Wait for elements** - Use `waitFor` or locator waits
3. **Mock APIs** - Use `context.route()` for consistent data
4. **Test user flows** - Not implementation details
5. **Be specific** - Use unique selectors, avoid xpath
6. **Clean up** - Close pages/contexts if needed

### Selectors

Prefer in order:
1. `text=` or `:has-text()` - User-visible text
2. `role=` - Semantic HTML roles
3. `placeholder=` - Form inputs
4. `data-testid=` - Explicit test attributes
5. CSS selectors - As fallback

## Debugging

### Visual Debugging
```bash
npm run test:e2e:ui
```

Interactive mode showing live preview and step-through.

### Debug Mode
```bash
npm run test:e2e:debug
```

Opens browser with Playwright Inspector.

### View Traces
```bash
npx playwright show-trace trace.zip
```

Replay test execution with full DOM snapshots.

## CI/CD Integration

Tests run automatically on:
- Pull requests
- Commits to main
- Nightly schedule

Retries: 2 attempts on CI, 0 in development

## Common Assertions

```typescript
// Visibility
await expect(page.locator('selector')).toBeVisible();
await expect(page.locator('selector')).toBeHidden();

// Values
await expect(page.locator('input')).toHaveValue('text');
await expect(page.locator('button')).toBeEnabled();
await expect(page.locator('button')).toBeDisabled();

// Text
await expect(page.locator('h1')).toHaveText('Title');
await expect(page.locator('div')).toContainText('partial');

// Attributes
await expect(page.locator('img')).toHaveAttribute('src', '/path');

// Count
await expect(page.locator('li')).toHaveCount(3);
```

## Troubleshooting

### Tests timeout
- Increase timeout: `test.setTimeout(10000)`
- Check if elements load: Add `waitForLoadState('networkidle')`

### Flaky tests
- Use `waitFor()` instead of immediate assertions
- Mock APIs to avoid network variability
- Avoid `setTimeout` - use waits instead

### Failed on CI
- Check test recording: `npx playwright show-trace`
- Verify CI environment: PORT, BASE_URL, API endpoints
- Check for race conditions in setup/teardown

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Debug Guide](https://playwright.dev/docs/debug)
- [API Reference](https://playwright.dev/docs/api/intro)
