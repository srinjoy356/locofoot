import { test, expect } from '@playwright/test';

test.describe('Phase 2 Workflow', () => {
  test('Full Phase 2 E2E workflow: Event creation, Team Registration, and Approval', async ({ page, browser }) => {
    await page.goto('/e2e-test');

    // 1. Organizer Login and Event Creation
    await page.fill('[data-testid="login-email"]', 'e2e_organizer@example.com');
    await page.fill('[data-testid="login-password"]', 'password123');
    await page.click('[data-testid="login-btn"]');
    
    // Wait for login
    await expect(page.locator('[data-testid="log-msg"]').filter({ hasText: /Logged in as e2e_organizer@example.com/ })).toBeVisible({ timeout: 10000 });

    // Create Event
    await page.click('[data-testid="create-event-btn"]');
    await expect(page.locator('[data-testid="log-msg"]').filter({ hasText: /Created Event:/ })).toBeVisible();
    
    // Extract Event ID from logs
    const eventLogText = await page.locator('[data-testid="log-msg"]').filter({ hasText: /Created Event:/ }).textContent();
    const eventId = eventLogText?.split(': ')[1];
    expect(eventId).toBeDefined();

    // Open Registration
    await page.click('[data-testid="fetch-events-btn"]');
    await page.click(`[data-testid="open-reg-${eventId}"]`);
    await expect(page.locator('[data-testid="log-msg"]').filter({ hasText: /Registration opened/ })).toBeVisible();

    // Logout
    await page.click('[data-testid="logout-btn"]');

    // 2. Captain Login and Team Creation
    await page.fill('[data-testid="login-email"]', 'e2e_captain@example.com');
    await page.fill('[data-testid="login-password"]', 'password123');
    await page.click('[data-testid="login-btn"]');
    await expect(page.locator('[data-testid="log-msg"]').filter({ hasText: /Logged in as e2e_captain@example.com/ })).toBeVisible();

    // Create Team
    await page.click('[data-testid="create-team-btn"]');
    await expect(page.locator('[data-testid="log-msg"]').filter({ hasText: /Created Team:/ })).toBeVisible();

    const teamLogText = await page.locator('[data-testid="log-msg"]').filter({ hasText: /Created Team:/ }).textContent();
    const teamId = teamLogText?.split(': ')[1];
    expect(teamId).toBeDefined();

    // We assume the user creates team, invites friend. Our UI mock is basic, we can directly register.
    await page.fill('#ev-id', eventId!);
    await page.fill('#tm-id', teamId!);
    await page.click('[data-testid="register-team-btn"]');
    await expect(page.locator('[data-testid="log-msg"]').filter({ hasText: /Registered Team:/ })).toBeVisible();

    const regLogText = await page.locator('[data-testid="log-msg"]').filter({ hasText: /Registered Team:/ }).textContent();
    const regId = regLogText?.split(': ')[1];
    expect(regId).toBeDefined();

    // For E2E we can also test adding roster but let's test approval flow
    await page.click('[data-testid="logout-btn"]');

    // 3. Organizer approves registration
    await page.fill('[data-testid="login-email"]', 'e2e_organizer@example.com');
    await page.fill('[data-testid="login-password"]', 'password123');
    await page.click('[data-testid="login-btn"]');
    await expect(page.locator('[data-testid="log-msg"]').filter({ hasText: /Logged in as e2e_organizer@example.com/ }).last()).toBeVisible();

    await page.fill('#ev-id', eventId!);
    await page.fill('#reg-id', regId!);
    await page.click('[data-testid="approve-reg-btn"]');
    await expect(page.locator('[data-testid="log-msg"]').filter({ hasText: /Approved registration: 200/ })).toBeVisible();
    
    // Everything works!
  });
});
