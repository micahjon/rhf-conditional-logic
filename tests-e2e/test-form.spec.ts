import { test, expect } from "@playwright/test";

test("is the right page", async ({ page }) => {
  await page.goto("/");

  // Expect a title "to contain" a substring.
  expect(page).toHaveTitle(/React Hook Form Conditional Logic Test/);
});

test("conditional fields are shown when appropriate", async ({ page }) => {
  await page.goto("/");

  // Sanity check to ensure form has rendered
  expect(await page.getByLabel("Email")).toBeVisible();

  // Conditional fields should both be hidden by default
  expect(await page.getByLabel("Other Caterer")).toBeHidden();
  expect(await page.getByText("Wine Pairing")).toBeHidden();

  // Now toggle on the fields that control them
  await page.getByLabel("Other").check();
  expect(await page.getByLabel("Other Caterer")).toBeVisible();

  await page.getByLabel("21+").check();
  expect(await page.getByText("Wine Pairing")).toBeVisible();
});

test("hidden field with invalid content is ignored", async ({ page }) => {
  await page.goto("/");

  // Show hidden field, add invalid content, and hide it again
  await page.getByLabel("Other").check();
  expect(await page.getByLabel("Other Caterer")).toBeVisible();
  await page.getByLabel("Other Caterer").fill("."); // .min(2) is required
  await page.getByLabel("Elephants Catering").check();
  expect(await page.getByLabel("Other Caterer")).toBeHidden();

  // Now fill in all remaining fields and submit
  await page.getByLabel("Your Name").fill("Micah");
  await page.getByLabel("Email").fill("micah@test.com");
  await page.getByLabel("Guest Name").fill("Bob");
  await page.getByLabel("13 - 20").check();
  await page.getByText("Submit").click();

  // There should be no errors on the form and the inputs should be blank
  expect(await page.getByRole("alert")).toBeHidden();
  expect(await page.getByLabel("Your Name")).toBeEmpty();
});
