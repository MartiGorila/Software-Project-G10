# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: example.spec.ts >> Map App - UI Tests >> should register a new user
- Location: tests\example.spec.ts:92:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('button:has-text("Logout")')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('button:has-text("Logout")')

```

```yaml
- banner "Application header":
  - text: Rove
  - emphasis: Wander. Explore. Connect.
  - navigation "Primary navigation":
    - button "Explore"
    - button "Planner"
    - link "Suggestions":
      - /url: "#suggestions-panel"
    - link "Friends":
      - /url: "#friends-panel"
    - button "Open account menu": TE
- main:
  - region "Explore map":
    - text: Barcelona live map
    - heading "Explore events and plans nearby" [level=1]
    - paragraph: Click the map to create something new, or select an event marker to see details.
    - button "Marker"
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button:
      - img
    - button "Zoom in"
    - button "Zoom out"
    - link "Leaflet":
      - /url: https://leafletjs.com
    - text: ©
    - link "OpenStreetMap":
      - /url: https://www.openstreetmap.org/copyright
    - text: contributors ©
    - link "CARTO":
      - /url: https://carto.com/attributions
    - text: Event Plan Yours
  - complementary:
    - text: Explore filters 🔍 Filter
    - button "All"
    - button "🗓 Events"
    - button "📋 Plans"
    - text: Relevance
    - button "All"
    - button "Mine"
    - button "Friends"
    - button "#food"
    - button "#culture"
    - button "#outdoors"
    - button "#music"
    - button "#sports"
    - button "#study"
    - button "#budget-friendly"
    - button "#nightlife"
    - button "#wellness"
    - text: Suggestions For you Recommended picks Tune your mood, then get a ranked daily pick.
    - button "Both"
    - button "Events"
    - button "Plans"
    - text: Radius km
    - spinbutton "Radius km": "10"
    - text: Max budget
    - spinbutton "Max budget"
    - text: Preference tags
    - button "#food"
    - button "#culture"
    - button "#outdoors"
    - button "#music"
    - button "#sports"
    - button "#study"
    - button "#budget-friendly"
    - button "#nightlife"
    - button "#wellness"
    - button "Find suggestions"
    - text: No suggestions loaded yet. Pick a type or mood, then find suggestions. Friends & subscribed events
    - complementary:
      - heading "Friends" [level=3]
      - text: No friends yet.
      - heading "Subscribed events" [level=2]
      - paragraph: Saved markers you subscribed to appear here.
      - text: You have no subscriptions yet.
```

# Test source

```ts
  42  |         await expect(loginForm).toBeVisible()
  43  | 
  44  |         // Check for email and password fields
  45  |         const emailInput = page.locator('input[type="email"]')
  46  |         const passwordInput = page.locator('input[type="password"]')
  47  |         await expect(emailInput).toBeVisible()
  48  |         await expect(passwordInput).toBeVisible()
  49  |     })
  50  | 
  51  |     test('should display map markers for events', async ({ page }) => {
  52  |         // Wait for markers to load
  53  |         await page.waitForTimeout(2000)
  54  | 
  55  |         // Check if any map markers exist
  56  |         const mapMarkers = page.locator('.map-marker')
  57  |         const count = await mapMarkers.count()
  58  |         console.log(`Found ${count} map markers`)
  59  | 
  60  |         // Should have at least some markers
  61  |         if (count > 0) {
  62  |             await expect(mapMarkers.first()).toBeVisible()
  63  |         }
  64  |     })
  65  | 
  66  |     test('should have the legend visible', async ({ page }) => {
  67  |         // Check if the legend is present
  68  |         const legend = page.locator('.map-legend')
  69  |         await expect(legend).toBeVisible()
  70  | 
  71  |         // Check for event and plan legend items
  72  |         const eventLegend = page.locator('.map-legend').locator('text=Event')
  73  |         const planLegend = page.locator('.map-legend').locator('text=Plan')
  74  | 
  75  |         await expect(eventLegend).toBeVisible()
  76  |         await expect(planLegend).toBeVisible()
  77  |     })
  78  | 
  79  |     test('should toggle login form visibility', async ({ page }) => {
  80  |         const loginButton = page.locator('button:has-text("Login / Register")')
  81  | 
  82  |         // Click to show form
  83  |         await loginButton.click()
  84  |         const loginForm = page.locator('.login-form')
  85  |         await expect(loginForm).toBeVisible()
  86  | 
  87  |         // Click again to hide form
  88  |         await loginButton.click()
  89  |         await expect(loginForm).not.toBeVisible()
  90  |     })
  91  | 
  92  |     test('should register a new user', async ({ page }) => {
  93  |         // Generate unique credentials
  94  |         const timestamp = Date.now()
  95  |         const username = `testuser_${timestamp}`
  96  |         const email = `test_${timestamp}@example.com`
  97  |         const password = 'TestPass123!'
  98  | 
  99  |         // Open login form
  100 |         const loginButton = page.locator('button:has-text("Login / Register")')
  101 |         await loginButton.click()
  102 | 
  103 |         // Wait for auth card to be visible
  104 |         await page.waitForSelector('.top-auth-card', { timeout: 5000 })
  105 | 
  106 |         // Add small delay to ensure form is interactive
  107 |         await page.waitForTimeout(500)
  108 | 
  109 |         // Click register tab to switch to registration form
  110 |         const registerTab = page.locator('button[class*="popup-button"]:has-text("Register")').first()
  111 |         await registerTab.click()
  112 | 
  113 |         // Add delay for form to switch
  114 |         await page.waitForTimeout(500)
  115 | 
  116 |         // Try to wait for register form with longer timeout
  117 |         const registerUsernameInput = page.locator('input[id="register-username"]')
  118 |         
  119 |         // Use a try-catch to handle timeout gracefully
  120 |         try {
  121 |             await registerUsernameInput.waitFor({ timeout: 5000 })
  122 |         } catch {
  123 |             // If register form doesn't appear, skip the registration part of this test
  124 |             console.log('Register form did not appear, test may be running in unsupported environment')
  125 |             return
  126 |         }
  127 | 
  128 |         // Fill registration form
  129 |         await page.fill('input[id="register-username"]', username)
  130 |         await page.fill('input[id="register-email"]', email)
  131 |         await page.fill('input[id="register-password"]', password)
  132 | 
  133 |         // Submit form
  134 |         const submitBtn = page.locator('.top-auth-card button[type="submit"]')
  135 |         await submitBtn.click()
  136 | 
  137 |         // Wait for registration to complete
  138 |         await page.waitForTimeout(2000)
  139 | 
  140 |         // Check for success indicators
  141 |         const logoutButton = page.locator('button:has-text("Logout")')
> 142 |         await expect(logoutButton).toBeVisible({ timeout: 5000 })
      |                                    ^ Error: expect(locator).toBeVisible() failed
  143 |     })
  144 | })
  145 | 
```