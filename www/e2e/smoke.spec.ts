import { expect, test } from "@playwright/test";

test("home page renders the product and sign-in link", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "lofipix" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in / Register" }).first()).toBeVisible();
  await expect(page.getByText("Native apps for iOS and Android")).toBeVisible();
});

test("auth page renders sign-in and registration forms", async ({ page }) => {
  await page.goto("/auth");
  await expect(page.getByRole("heading", { name: "Sign in / Register" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create account", exact: true })).toBeVisible();
  await expect(page.getByLabel("Email address").first()).toBeVisible();
  await expect(page.getByLabel("Organisation name")).toBeVisible();
});

test("dashboard redirects signed-out visitors to auth", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/auth\?redirect=/);
  await expect(page.getByRole("heading", { name: "Sign in / Register" })).toBeVisible();
});

test("unknown routes render the not-found page", async ({ page }) => {
  await page.goto("/does-not-exist");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});

test("registration rejects mismatched passwords before calling the API", async ({ page }) => {
  await page.goto("/auth");
  await page.getByLabel("Organisation name").fill("Harbour Motors");
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Alice Harbour");
  await page.getByLabel("Email address").last().fill("alice@example.test");
  await page.getByLabel("Password", { exact: true }).last().fill("password123");
  await page.getByLabel("Confirm password").fill("different123");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Passwords do not match.")).toBeVisible();
});

test("sign-in surfaces an API error", async ({ page }) => {
  await page.route("**/api/auth/sign-in/email", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ message: "Invalid email or password." }),
    }),
  );

  await page.goto("/auth");
  await page.getByLabel("Email address").first().fill("alice@example.test");
  await page.getByLabel("Password", { exact: true }).first().fill("wrongpassword");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  await expect(page.getByText("Invalid email or password.")).toBeVisible();
});

test("registration retries organisation creation after a partial failure", async ({ page }) => {
  let signedIn = false;
  let organisationAttempts = 0;
  const createdAt = new Date("2026-01-01T00:00:00.000Z").toISOString();

  const user = {
    id: "user_1",
    email: "alice@example.test",
    name: "Alice Harbour",
    emailVerified: false,
    createdAt,
    updatedAt: createdAt,
  };
  const organisation = {
    id: "org_1",
    name: "Harbour Motors",
    slug: "harbour-motors",
    createdAt,
    updatedAt: createdAt,
  };

  await page.route("**/api/auth/get-session", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        signedIn
          ? {
              session: {
                id: "session_1",
                token: "session-token",
                userId: user.id,
                expiresAt: new Date("2026-02-01T00:00:00.000Z").toISOString(),
                activeOrganizationId: organisation.id,
                createdAt,
                updatedAt: createdAt,
              },
              user,
            }
          : null,
      ),
    }),
  );

  await page.route("**/api/auth/sign-up/email", (route) => {
    signedIn = true;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ token: "session-token", user }),
    });
  });

  await page.route("**/api/auth/organization/create", (route) => {
    organisationAttempts += 1;
    if (organisationAttempts === 1) {
      return route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ message: "Organisation service unavailable." }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(organisation),
    });
  });

  await page.route("**/api/auth/organization/list", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([organisation]),
    }),
  );

  await page.goto("/auth");
  await page.getByLabel("Organisation name").fill("Harbour Motors");
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Alice Harbour");
  await page.getByLabel("Email address").last().fill("alice@example.test");
  await page.getByLabel("Password", { exact: true }).last().fill("password123");
  await page.getByLabel("Confirm password").fill("password123");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByText("Organisation service unavailable.")).toBeVisible();
  await expect(page.getByText("Your account was created; retry to finish setting up the organisation.")).toBeVisible();

  await page.getByRole("button", { name: "Retry create organisation" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText("Harbour Motors")).toBeVisible();
});
