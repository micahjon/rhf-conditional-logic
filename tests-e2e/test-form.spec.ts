import { test, expect } from '@playwright/test';

declare global {
  interface Window {
    formSubmissionDataForTests: Record<string, string>;
  }
}

test('is the right page', async ({ page }) => {
  await page.goto('/');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/React Hook Form Conditional Logic Test/);
});

test('conditional fields are shown when appropriate', async ({ page }) => {
  await page.goto('/');

  // Sanity check to ensure form has rendered
  expect(await page.getByLabel('Email')).toBeVisible();

  // Conditional fields should both be hidden by default
  expect(await page.getByLabel('Other Caterer')).toBeHidden();
  expect(await page.getByText('Wine Pairing')).toBeHidden();

  // Now toggle on the fields that control them
  await page.getByLabel('Other').check();
  expect(await page.getByLabel('Other Caterer')).toBeVisible();

  await page.getByLabel('21+').check();
  expect(await page.getByText('Wine Pairing')).toBeVisible();
});

test('unselected radios show required errors on initial submission and after reset', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Please select a caterer' })
  ).toBeVisible();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Please select an age' })
  ).toBeVisible();

  await page.getByLabel('Your Name').fill('Test');
  await page.getByLabel('Email').fill('test@example.com');
  await page.getByLabel('Delta BBQ').check();
  await page.getByLabel('Guest Name').fill('Guest');
  await page.getByLabel('13 - 20').check();
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(page.getByLabel('Your Name')).toBeEmpty();
  await expect(page.getByRole('alert')).toHaveCount(0);

  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Please select a caterer' })
  ).toBeVisible();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Please select an age' })
  ).toBeVisible();
});

test('hidden field with invalid content is ignored', async ({ page }) => {
  await page.goto('/');

  // Show hidden field, add invalid content, and hide it again
  await page.getByLabel('Other').check();
  expect(await page.getByLabel('Other Caterer')).toBeVisible();
  await page.getByLabel('Other Caterer').fill('.'); // .min(2) is required
  await page.getByLabel('Elephants Catering').check();
  expect(await page.getByLabel('Other Caterer')).toBeHidden();

  // Show nested hidden field, add content, and hide it again
  await page.getByLabel('21+').check();
  await page.getByLabel('White').check();

  // Now fill in all remaining fields and submit
  await page.getByLabel('Your Name').fill('Micah');
  await page.getByLabel('Email').fill('micah@test.com');
  await page.getByLabel('Guest Name').fill('Bob');
  await page.getByLabel('13 - 20').check();
  await page.getByText('Submit').click();

  const validFormData = await page.evaluate(() =>
    JSON.stringify(window.formSubmissionDataForTests)
  );
  expect(validFormData).toEqual(
    JSON.stringify({
      contactName: 'Micah',
      contactEmail: 'micah@test.com',
      caterer: 'Elephants Catering',
      // Other Caterer = "." should be omitted
      guests: [
        {
          name: 'Bob',
          age: '13-20',
          // Wine Pairing = White should be omitted
        },
      ],
    })
  );

  // There should be no errors on the form and the inputs should be blank
  expect(await page.getByRole('alert')).toBeHidden();
  expect(await page.getByLabel('Your Name')).toBeEmpty();
});
