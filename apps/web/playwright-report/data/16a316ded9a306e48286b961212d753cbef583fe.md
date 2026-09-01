# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: phase2.spec.ts >> Phase 2 Workflow >> Full Phase 2 E2E workflow: Event creation, Team Registration, and Approval
- Location: e2e\phase2.spec.ts:4:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('[data-testid="log-msg"]').filter({ hasText: /Logged in as e2e_organizer@example.com/ })
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('[data-testid="log-msg"]').filter({ hasText: /Logged in as e2e_organizer@example.com/ })

```

```yaml
- main:
  - heading "E2E Test Harness" [level=1]
  - 'heading "Auth (Current: None)" [level=2]'
  - textbox "Email"
  - textbox "Password": password123
  - button "Login"
  - button "Logout"
  - heading "Events (Organizer)" [level=2]
  - button "Create Event"
  - button "Fetch Events"
  - heading "Teams (Captain/Player)" [level=2]
  - button "Create Team"
  - button "Fetch Teams"
  - heading "Registration Actions" [level=2]
  - text: "Use the DevTools console or backend directly for complex flows if needed, or implement inputs below:"
  - textbox "Event ID"
  - textbox "Team ID"
  - button "Register Team"
  - textbox "Registration ID"
  - textbox "User ID"
  - button "Add to Roster"
  - button "Approve Registration"
  - heading "Logs" [level=2]
  - text: "Login Error: missing email or phone"
- alert
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Phase 2 Workflow', () => {
  4  |   test('Full Phase 2 E2E workflow: Event creation, Team Registration, and Approval', async ({ page, browser }) => {
  5  |     await page.goto('/e2e-test');
  6  | 
  7  |     // 1. Organizer Login and Event Creation
  8  |     await page.fill('[data-testid="login-email"]', 'e2e_organizer@example.com');
  9  |     await page.fill('[data-testid="login-password"]', 'password123');
  10 |     await page.click('[data-testid="login-btn"]');
  11 |     
  12 |     // Wait for login
> 13 |     await expect(page.locator('[data-testid="log-msg"]').filter({ hasText: /Logged in as e2e_organizer@example.com/ })).toBeVisible({ timeout: 10000 });
     |                                                                                                                         ^ Error: expect(locator).toBeVisible() failed
  14 | 
  15 |     // Create Event
  16 |     await page.click('[data-testid="create-event-btn"]');
  17 |     await expect(page.locator('[data-testid="log-msg"]').filter({ hasText: /Created Event:/ })).toBeVisible();
  18 |     
  19 |     // Extract Event ID from logs
  20 |     const eventLogText = await page.locator('[data-testid="log-msg"]').filter({ hasText: /Created Event:/ }).textContent();
  21 |     const eventId = eventLogText?.split(': ')[1];
  22 |     expect(eventId).toBeDefined();
  23 | 
  24 |     // Open Registration
  25 |     await page.click('[data-testid="fetch-events-btn"]');
  26 |     await page.click(`[data-testid="open-reg-${eventId}"]`);
  27 |     await expect(page.locator('[data-testid="log-msg"]').filter({ hasText: /Registration opened/ })).toBeVisible();
  28 | 
  29 |     // Logout
  30 |     await page.click('[data-testid="logout-btn"]');
  31 | 
  32 |     // 2. Captain Login and Team Creation
  33 |     await page.fill('[data-testid="login-email"]', 'e2e_captain@example.com');
  34 |     await page.fill('[data-testid="login-password"]', 'password123');
  35 |     await page.click('[data-testid="login-btn"]');
  36 |     await expect(page.locator('[data-testid="log-msg"]').filter({ hasText: /Logged in as e2e_captain@example.com/ })).toBeVisible();
  37 | 
  38 |     // Create Team
  39 |     await page.click('[data-testid="create-team-btn"]');
  40 |     await expect(page.locator('[data-testid="log-msg"]').filter({ hasText: /Created Team:/ })).toBeVisible();
  41 | 
  42 |     const teamLogText = await page.locator('[data-testid="log-msg"]').filter({ hasText: /Created Team:/ }).textContent();
  43 |     const teamId = teamLogText?.split(': ')[1];
  44 |     expect(teamId).toBeDefined();
  45 | 
  46 |     // We assume the user creates team, invites friend. Our UI mock is basic, we can directly register.
  47 |     await page.fill('#ev-id', eventId!);
  48 |     await page.fill('#tm-id', teamId!);
  49 |     await page.click('[data-testid="register-team-btn"]');
  50 |     await expect(page.locator('[data-testid="log-msg"]').filter({ hasText: /Registered Team:/ })).toBeVisible();
  51 | 
  52 |     const regLogText = await page.locator('[data-testid="log-msg"]').filter({ hasText: /Registered Team:/ }).textContent();
  53 |     const regId = regLogText?.split(': ')[1];
  54 |     expect(regId).toBeDefined();
  55 | 
  56 |     // For E2E we can also test adding roster but let's test approval flow
  57 |     await page.click('[data-testid="logout-btn"]');
  58 | 
  59 |     // 3. Organizer approves registration
  60 |     await page.fill('[data-testid="login-email"]', 'e2e_organizer@example.com');
  61 |     await page.fill('[data-testid="login-password"]', 'password123');
  62 |     await page.click('[data-testid="login-btn"]');
  63 |     await expect(page.locator('[data-testid="log-msg"]').filter({ hasText: /Logged in as e2e_organizer@example.com/ }).last()).toBeVisible();
  64 | 
  65 |     await page.fill('#ev-id', eventId!);
  66 |     await page.fill('#reg-id', regId!);
  67 |     await page.click('[data-testid="approve-reg-btn"]');
  68 |     await expect(page.locator('[data-testid="log-msg"]').filter({ hasText: /Approved registration: 200/ })).toBeVisible();
  69 |     
  70 |     // Everything works!
  71 |   });
  72 | });
  73 | 
```