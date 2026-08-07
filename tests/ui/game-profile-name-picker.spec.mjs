import { expect, test } from "./fixtures.mjs";

const skyGeneratorDefinition = `title = Sky Name Generator

names
  [vowels][consonants][vowels][consonants]
  [consonants][vowels][consonants][vowels]
  [vowels][consonants][vowels][consonants][vowels]
  [consonants][vowels][consonants][vowels][consonants]
  [vowels][consonants][vowels][consonants][vowels][consonants]
  [consonants][vowels][consonants][vowels][consonants][vowels]
  [vowels][consonants][vowels][consonants][vowels][consonants][vowels]
  [consonants][vowels][consonants][vowels][consonants][vowels][consonants]
  [vowels][consonants][vowels][consonants][vowels][consonants][vowels][consonants]
  [consonants][vowels][consonants][vowels][consonants][vowels][consonants][vowels]

vowels
  a
  e
  i
  o
  u

consonants
  b
  c
  d
  f
  g
  h ^0.5
  j
  k
  l
  m
  n
  p
  q ^0.5
  r
  s
  t
  v
  w ^0.5
  x ^0.5
  y
  z ^0.5`;

const viewports = Object.freeze([
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
  { name: "wide desktop", width: 1440, height: 900 },
]);

const prepareNamePicker = async (page) => {
  await page.route(/https:\/\/perchance\.org\/api\/downloadGenerator/, (route) =>
    route.fulfill({ body: skyGeneratorDefinition, contentType: "text/plain" })
  );
  await page.goto("/home.html");
  const aboutWindowClose = page.locator('#about-window [data-close="about"]');
  if (await aboutWindowClose.isVisible()) {
    await aboutWindowClose.click();
  }
  await page.locator('.desktop-icon[data-app="game-progress"]').click();
  await page.getByRole("button", { name: "Create Profile" }).click();

  const dialog = page.getByRole("dialog", { name: "Leaderboard Profile" });
  const combobox = dialog.getByRole("combobox", { name: "Name" });
  const listbox = dialog.getByRole("listbox", { name: "Generated names" });
  await expect(dialog).toBeVisible();
  await expect(combobox).toBeVisible();
  await expect(listbox).toBeVisible();
  await expect(listbox.getByRole("option")).toHaveCount(5);
  await expect(dialog.locator(".game-profile-name-credit")).toHaveText(
    "via Sky Name Generator on Perchance"
  );

  return { combobox, dialog, listbox };
};

for (const viewport of viewports) {
  test(`five-name profile picker remains contained at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const { combobox, dialog, listbox } = await prepareNamePicker(page);

    await expect(combobox).not.toBeDisabled();
    await expect(combobox).toHaveAttribute("aria-expanded", "true");
    await expect(combobox).not.toHaveValue("");

    const layout = await page.evaluate(() => {
      const dialogElement = document.querySelector("#game-profile-dialog");
      const listboxElement = document.querySelector("#game-profile-name-options");
      const comboboxElement = document.querySelector("#game-profile-name");
      const toggleElement = document.querySelector("#game-profile-name-toggle");
      const getRect = (element) => {
        const { bottom, left, right, top } = element.getBoundingClientRect();
        return { bottom, left, right, top };
      };
      return {
        combobox: getRect(comboboxElement),
        dialog: getRect(dialogElement),
        documentOverflows: document.documentElement.scrollWidth > window.innerWidth,
        listbox: getRect(listboxElement),
        toggle: getRect(toggleElement),
      };
    });

    expect(layout.documentOverflows).toBe(false);
    expect(layout.listbox.left).toBeGreaterThanOrEqual(layout.dialog.left);
    expect(layout.listbox.right).toBeLessThanOrEqual(layout.dialog.right);
    expect(layout.listbox.top).toBeGreaterThanOrEqual(layout.combobox.bottom);
    expect(layout.listbox.bottom).toBeLessThanOrEqual(layout.dialog.bottom);
    expect(layout.toggle.left).toBeGreaterThanOrEqual(layout.combobox.left);
    expect(layout.toggle.right).toBeLessThanOrEqual(layout.combobox.right);
    expect(layout.toggle.top).toBeGreaterThanOrEqual(layout.combobox.top);
    expect(layout.toggle.bottom).toBeLessThanOrEqual(layout.combobox.bottom);
  });
}

test("profile picker highlights, selects, rerolls, and retains the chosen favorite", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const { combobox, dialog, listbox } = await prepareNamePicker(page);
  const option = listbox.getByRole("option").nth(1);
  const selectedName = await option.textContent();

  await option.hover();
  await expect(option).toHaveCSS("background-color", "rgb(0, 0, 128)");
  await expect(option).toHaveCSS("color", "rgb(255, 255, 255)");
  await option.click();
  await expect(combobox).toHaveValue(selectedName);
  await expect(combobox).toHaveAttribute("aria-expanded", "false");
  await expect(listbox).toBeHidden();
  await expect(dialog.getByRole("button", { name: "Save Profile" })).toBeEnabled();

  const toggle = page.locator("#game-profile-name-toggle");
  await toggle.click();
  await expect(listbox).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await toggle.click();
  await expect(listbox).toBeHidden();

  await combobox.click();
  await expect(listbox).toBeVisible();
  await expect(listbox.getByRole("option", { selected: true })).toHaveText(selectedName);
  await combobox.press("ArrowDown");
  await expect(combobox).toHaveAttribute(
    "aria-activedescendant",
    "game-profile-name-option-2"
  );
  await combobox.press("Enter");
  const favoriteName = await combobox.inputValue();
  await expect(favoriteName).not.toBe(selectedName);
  await expect(listbox).toBeHidden();

  await combobox.click();
  await expect(listbox).toBeVisible();
  await combobox.press("Escape");
  await expect(listbox).toBeHidden();
  await expect(dialog).toBeVisible();

  await dialog.getByRole("button", { name: /Reroll generated name/ }).click();
  await expect(listbox).toBeVisible();
  await expect(combobox).toHaveValue(favoriteName);
  await expect(listbox.getByRole("option")).toHaveCount(5);
  await expect(listbox.getByRole("option", { selected: true })).toHaveCount(0);
  await expect(listbox.locator(".is-active")).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: /Reroll available in 3 seconds/ })).toBeDisabled();

  const replacement = listbox.getByRole("option").nth(2);
  const replacementName = await replacement.textContent();
  await replacement.click();
  await expect(combobox).toHaveValue(replacementName);
  await expect(listbox).toBeHidden();
});
