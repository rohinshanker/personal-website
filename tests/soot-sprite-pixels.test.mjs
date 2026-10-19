import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";

import { readHomeScript } from "./helpers/home-scripts.mjs";
import { sourceBetween } from "./helpers/source-runtime.mjs";

/**
 * Runs the production pixel-art helpers of the soot-sprite event with a
 * recording 2D context, so the cell geometry, coat, eyes, sheets and
 * stepped animations are checked against the look contract in the ticket.
 */
const source = await readHomeScript("eventSootSprites");

const createRecorder = () => {
  const context = {
    fillStyle: "",
    fills: [],
    offsetX: 0,
    offsetY: 0,
    stack: [],
    fillRect(x, y, width, height) {
      this.fills.push({
        x: x + this.offsetX,
        y: y + this.offsetY,
        width,
        height,
        fillStyle: this.fillStyle,
      });
    },
    save() {
      this.stack.push([this.offsetX, this.offsetY]);
    },
    restore() {
      [this.offsetX, this.offsetY] = this.stack.pop();
    },
    translate(x, y) {
      this.offsetX += x;
      this.offsetY += y;
    },
  };
  return context;
};

const loadPixelHelpers = () => {
  const canvases = [];
  const document = {
    createElement(name) {
      assert.equal(name, "canvas");
      const canvas = {
        width: 0,
        height: 0,
        context: createRecorder(),
        getContext(kind) {
          assert.equal(kind, "2d");
          return this.context;
        },
        toDataURL(type) {
          assert.equal(type, "image/png");
          return `data:image/png;base64,${this.width}x${this.height}`;
        },
      };
      canvases.push(canvas);
      return canvas;
    },
  };
  const script = `(() => {
${sourceBetween(source, "const SOOT_SPRITES_CANDY_COLORS", "const isSootSpritesVisible")}
${sourceBetween(source, "const randomSootSpriteValue", "const setSootSpritePx")}
${sourceBetween(source, "const getSootSpriteGeometry", "const createSootSpriteElement")}
return {
  SOOT_LOOKS,
  SOOT_SPRITES_CANDY_COLORS,
  createSootBoilKeyframes,
  createSootJitterKeyframes,
  createSootSpriteSheet,
  drawSootCoat,
  drawSootEyes,
  drawSootSpritePlan,
  getSootEffectSheets,
  getSootSpriteGeometry,
  planSootSprite,
  renderSootCandySheet,
  renderSootPuffSheet,
  setSootCandyLook,
  setSootPuffLook,
};
})()`;
  const helpers = vm.runInNewContext(script, {
    document,
    window: { matchMedia: () => ({ matches: false }) },
    Math,
    Number,
  });
  return { helpers, canvases };
};

const cellsOf = (fills, predicate) => {
  const cells = new Set();
  fills.filter(predicate).forEach(({ x, y, width, height }) => {
    for (let row = 0; row < height; row += 1) {
      for (let column = 0; column < width; column += 1) cells.add(`${x + column},${y + row}`);
    }
  });
  return cells;
};

test("the cell grid follows the look's unit with a floor of eight cells per body", () => {
  const { helpers } = loadPixelHelpers();
  const [reference, urchin] = helpers.SOOT_LOOKS;
  assert.deepEqual(
    { ...helpers.getSootSpriteGeometry(reference, 32) },
    { bodyCells: 16, cells: 26, centre: 13, cellPx: 2 },
  );
  assert.equal(helpers.getSootSpriteGeometry(urchin, 32).bodyCells, 21);
  assert.equal(helpers.getSootSpriteGeometry(reference, 8).bodyCells, 8);
  assert.equal(helpers.SOOT_LOOKS.length, 3);
});

test("the coat is a ring of single-cell hairs that stays inside the frame", () => {
  const { helpers } = loadPixelHelpers();
  const look = helpers.SOOT_LOOKS[0];
  const geometry = helpers.getSootSpriteGeometry(look, 32);
  const context = createRecorder();
  context.fillStyle = "#000";
  helpers.drawSootCoat(context, geometry, look.fur);
  const hairs = Math.round(Math.PI * geometry.bodyCells * look.fur.density);
  assert.ok(context.fills.length >= hairs, "every hair leaves at least one cell");
  context.fills.forEach(({ x, y, width, height }) => {
    assert.deepEqual([width, height], [1, 1]);
    assert.ok(x >= 0 && x < geometry.cells && y >= 0 && y < geometry.cells, "inside the frame");
  });
  const radius = geometry.bodyCells / 2;
  const farthest = Math.max(
    ...context.fills.map(({ x, y }) =>
      Math.hypot(x + 0.5 - geometry.centre, y + 0.5 - geometry.centre),
    ),
  );
  assert.ok(farthest <= radius + look.fur.max * geometry.bodyCells + 1, "no hair exceeds the look");
});

test("pupils are whole-cell squares that never leave the white of the eye", () => {
  const { helpers } = loadPixelHelpers();
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const look = helpers.SOOT_LOOKS[attempt % helpers.SOOT_LOOKS.length];
    const geometry = helpers.getSootSpriteGeometry(look, 24 + (attempt % 17));
    const context = createRecorder();
    const angle = Math.random() * Math.PI * 2;
    const reach = Math.random();
    helpers.drawSootEyes(context, geometry, {
      x: Math.cos(angle) * reach,
      y: Math.sin(angle) * reach,
    });
    const whites = cellsOf(context.fills, (fill) => fill.fillStyle === "#fff");
    const pupils = context.fills.filter((fill) => fill.fillStyle === "#000");
    assert.equal(pupils.length, 2);
    pupils.forEach((pupil) => {
      assert.equal(pupil.width, pupil.height);
      assert.ok(pupil.width >= 1);
      for (const cell of cellsOf([pupil], () => true)) {
        assert.ok(whites.has(cell), `pupil cell ${cell} sits on white`);
      }
    });
  }
});

test("a sprite plan draws two coat frames and one blink frame side by side", () => {
  const { helpers } = loadPixelHelpers();
  const sheet = helpers.createSootSpriteSheet(1);
  const plan = helpers.planSootSprite(32, 40, sheet);
  const widest = Math.max(
    ...helpers.SOOT_LOOKS.map((look) => helpers.getSootSpriteGeometry(look, 40).cells),
  );
  assert.equal(sheet.canvas.width, widest * 3);
  assert.equal(sheet.canvas.height, widest);
  assert.deepEqual([plan.sheetWidth, plan.sheetHeight], [sheet.canvas.width, sheet.canvas.height]);
  assert.ok(plan.geometry.cells <= widest);
  helpers.drawSootSpritePlan(sheet.context, plan);
  const { cells } = plan.geometry;
  const frameOf = (fill) => Math.floor((fill.x - 40) / cells);
  const whitesByFrame = [0, 1, 2].map((frame) =>
    sheet.context.fills.filter((fill) => fill.fillStyle === "#fff" && frameOf(fill) === frame),
  );
  assert.ok(whitesByFrame[0].length > whitesByFrame[2].length, "the blink frame shows slits");
  assert.equal(new Set(whitesByFrame[2].map((fill) => fill.y)).size, 1, "slits sit on one row");
  assert.ok(sheet.context.fills.every((fill) => fill.x >= 40 && fill.x < 40 + cells * 3));
  assert.deepEqual(sheet.context.stack, [], "every frame restores the context");
});

test("the boil alternates the two coats, blinks for one step and holds its last frame", () => {
  const { helpers } = loadPixelHelpers();
  const positions = ["0px 0px", "-52px 0px", "-104px 0px"];
  const keyframes = helpers.createSootBoilKeyframes(positions, 6400);
  assert.equal(keyframes.length, 41);
  assert.equal(keyframes[0].offset, 0);
  assert.equal(keyframes.at(-1).offset, 1);
  keyframes.forEach((frame, index) => {
    assert.equal(frame.easing, "step-end");
    assert.ok(positions.includes(frame.backgroundPosition));
    if (index > 0) assert.ok(frame.offset > keyframes[index - 1].offset);
  });
  const coats = keyframes.filter((frame) => frame.backgroundPosition !== positions[2]);
  assert.ok(coats.length >= keyframes.length - 3, "at most a few blink steps");
  assert.ok(
    keyframes.some((frame) => frame.backgroundPosition === positions[2]),
    "a blink happens",
  );
});

test("the tremble shifts by whole cells, within reach, and only hops once landed", () => {
  const { helpers } = loadPixelHelpers();
  const size = 32;
  const cellPx = 2;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const keyframes = helpers.createSootJitterKeyframes(
      { size, cellPx },
      { duration: 6000, landingProgress: 0.5 },
    );
    assert.equal(keyframes[0].transform, "translate(0px, 0px)");
    assert.equal(keyframes.at(-1).offset, 1);
    keyframes.forEach((frame, index) => {
      assert.equal(frame.easing, "step-end");
      if (index > 0) assert.ok(frame.offset >= keyframes[index - 1].offset);
      const [, dx, dy] = frame.transform
        .match(/translate\((-?[\d.]+)px, (-?[\d.]+)px\)/)
        .map(Number);
      assert.equal(Math.abs(dx) % cellPx, 0);
      assert.equal(Math.abs(dy) % cellPx, 0);
      const reach = (frame.offset >= 0.5 ? 0.06 : 0.03) * size * 2 + cellPx;
      assert.ok(Math.abs(dx) <= reach, `dx ${dx} within ${reach}`);
      if (frame.offset < 0.5) assert.ok(Math.abs(dy) <= reach, "no hop before landing");
      else assert.ok(Math.abs(dy) <= Math.max(reach, 0.22 * size + cellPx));
    });
    const gaps = keyframes
      .slice(1)
      .map((frame, index) => (frame.offset - keyframes[index].offset) * 6000);
    gaps.slice(0, -1).forEach((gap) => {
      assert.ok(gap >= 55 - 1e-6 && gap <= 115 + 1e-6, `gap ${gap}`);
    });
  }
});

test("the candy sheet holds every colour in both shapes and each candy picks a matching slot", () => {
  const { helpers, canvases } = loadPixelHelpers();
  const sheet = helpers.renderSootCandySheet();
  const canvas = canvases.at(-1);
  assert.deepEqual([canvas.width, canvas.height], [90, 9]);
  assert.equal(sheet.slots, 10);
  assert.match(sheet.image, /^url\("data:image\/png;base64,90x9"\)$/);
  const highlights = canvas.context.fills.filter((fill) => fill.fillStyle === "#fff");
  assert.equal(highlights.length, 10);
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const properties = new Map();
    helpers.setSootCandyLook({
      style: { setProperty: (key, value) => properties.set(key, value) },
    });
    const slot = Number(properties.get("--soot-candy-slot"));
    assert.ok(Number.isInteger(slot) && slot >= 0 && slot < 10);
    assert.equal(properties.get("--candy-color"), helpers.SOOT_SPRITES_CANDY_COLORS[slot % 5]);
  }
});

test("the smoke sheet draws six blobs in three shades and is rendered once per page", () => {
  const { helpers, canvases } = loadPixelHelpers();
  const sheets = helpers.getSootEffectSheets();
  assert.equal(helpers.getSootEffectSheets(), sheets, "cached");
  const puffCanvas = canvases.find((canvas) => canvas.width === 96 * 6);
  assert.ok(puffCanvas, "the puff sheet is 96 cells per shape");
  assert.equal(puffCanvas.height, 48);
  assert.equal(sheets.puff.shapes, 6);
  const alphas = new Set(puffCanvas.context.fills.map((fill) => fill.fillStyle));
  assert.deepEqual([...alphas].sort(), [
    "rgba(0, 0, 0, 0.16)",
    "rgba(0, 0, 0, 0.32)",
    "rgba(0, 0, 0, 0.5)",
  ]);
  puffCanvas.context.fills.forEach(({ x, y }) => {
    assert.ok(x >= 0 && x < 96 * 6 && y >= 0 && y < 48);
  });
  for (let shape = 0; shape < 6; shape += 1) {
    assert.ok(
      puffCanvas.context.fills.some((fill) => fill.x >= shape * 96 && fill.x < (shape + 1) * 96),
      `shape ${shape} is drawn`,
    );
  }
  const properties = new Map();
  helpers.setSootPuffLook({ style: { setProperty: (key, value) => properties.set(key, value) } });
  const picked = Number(properties.get("--soot-puff-shape"));
  assert.ok(Number.isInteger(picked) && picked >= 0 && picked < 6);
});
