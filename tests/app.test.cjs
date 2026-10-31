// Run with: node --test tests/app.test.cjs
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadApp(
  source = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8"),
) {
  let app;
  const context = {
    Vue: {
      ref: (value) => ({ value }),
      reactive: (value) => value,
      computed: (getter) => ({
        get value() {
          return getter();
        },
      }),
      createApp: ({ setup }) => ({
        mount: () => {
          app = setup();
        },
      }),
    },
  };
  vm.runInNewContext(source, context);
  return app;
}

async function importText(app, text) {
  const event = {
    target: { files: [{ text: async () => text }], value: "test.csv" },
  };
  await app.importCSV(event);
  assert.equal(event.target.value, "");
}

test("default pools are balanced and schedule contains each pairing once", () => {
  const app = loadApp();
  app.generatePools();
  assert.equal(app.pools.value.length, 6);
  for (const pool of app.pools.value) {
    assert.equal(pool.length, 4);
  }
  const totals = app.pools.value.map((pool) =>
    pool.reduce((sum, team) => sum + team.rating, 0),
  );
  assert.ok(Math.max(...totals) - Math.min(...totals) <= 2);
  app.generateSchedule();
  assert.equal(app.matches.value.length, 36);
  assert.equal(app.warnings.value.length, 0);
  const pairs = new Set(
    app.matches.value.map((m) =>
      [m.home.id, m.away.id].sort((a, b) => a - b).join("-"),
    ),
  );
  assert.equal(pairs.size, 36);
  const slots = new Set(app.matches.value.map((m) => `${m.ground}:${m.start}`));
  assert.equal(slots.size, 36);
});

test("readable preferences, aliases and typos import with mapping notes", async () => {
  for (const [phrase, expected] of [
    ["after 9 am", "after9"],
    ["After 9 A.M.", "after9"],
    ["back-to-back", "consecutive"],
    ["early mornng", "early"],
    ["gap between matches", "break"],
    ["after 9:30 am", "after10"],
  ]) {
    const app = loadApp();
    await importText(
      app,
      `name,rating,preference\nAlpha,2,none\nBravo,1,${phrase}`,
    );
    assert.match(app.importMessage.value, /^Imported 2/);
    assert.equal(app.teams.value[1].preference, expected);
  }
});

test("failed import preserves the roster and rejects approximate hard constraints", async () => {
  for (const phrase of [
    "after 9:30 am",
    "after 9 pm",
    "early and late",
    "unknown request",
  ]) {
    const app = loadApp();
    const original = app.teams.value;
    await importText(
      app,
      `name,rating,preference,required\nAlpha,2,none,false\nBravo,1,${phrase},true`,
    );
    assert.match(app.importMessage.value, /^Import error:/);
    assert.equal(app.teams.value, original);
  }
});

test("quoted names and preference row numbers survive CSV import", async () => {
  const app = loadApp();
  await importText(
    app,
    'name,rating,preference\n"Alpha, XI",2,early\n"Bravo ""Royals""",1,none',
  );
  assert.equal(app.teams.value[0].name, "Alpha, XI");
  assert.equal(app.teams.value[1].name, 'Bravo "Royals"');
  await importText(
    app,
    "name,rating,preference\nA,5,none\nB,4,none\nC,3,none\nD,2,none\nE,1,after 9 pm",
  );
  assert.match(app.importMessage.value, /Row 6/);
});

test("ranked CSV retains the provided 21-team order and descending ratings", async () => {
  const app = loadApp();
  await importText(
    app,
    fs.readFileSync(path.join(__dirname, "../teams-ranked.csv"), "utf8"),
  );
  assert.match(app.importMessage.value, /^Imported 21/);
  assert.equal(app.teams.value[0].name, "ECC Kurallu");
  assert.equal(app.teams.value[20].name, "ICL OGs");
  app.teams.value.forEach((team, i) => assert.equal(team.rating, 21 - i));
  app.generatePools();
  assert.equal(app.pools.value.flat().length, 21);
});

test("highest and lowest seeds stay apart for varied roster and pool sizes", () => {
  for (const count of [2, 3, 8, 21, 24, 32]) {
    for (const poolCount of [2, 3, 6]) {
      const app = loadApp();
      app.settings.teamCount = count;
      app.resizeTeams();
      app.settings.poolCount = poolCount;
      app.generatePools();
      const pools = app.pools.value;
      const firstPool = pools.findIndex((pool) =>
        pool.some((team) => team.id === 1),
      );
      const lastPool = pools.findIndex((pool) =>
        pool.some((team) => team.id === count),
      );
      assert.notEqual(
        firstPool,
        lastPool,
        `${count} teams / ${poolCount} pools`,
      );
      assert.equal(pools.flat().length, count);
      assert.equal(new Set(pools.flat().map((team) => team.id)).size, count);
      const sizes = pools.map((pool) => pool.length);
      assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1);
    }
  }
});

test("single-pool setup explains the impossible separation rule", () => {
  const app = loadApp();
  app.settings.poolCount = 1;
  app.generatePools();
  assert.equal(app.pools.value.length, 0);
  assert.match(app.importMessage.value, /at least 2 pools/);
});

test("poster fixture groups react to generation and pool resets", () => {
  const app = loadApp();
  assert.equal(app.scheduleView.value, "poster");
  assert.equal(app.fixtureGroups.value.length, 0);
  app.generatePools();
  app.generateSchedule();
  assert.equal(app.fixtureGroups.value.length, 6);
  assert.equal(
    app.fixtureGroups.value.reduce(
      (sum, group) => sum + group.matches.length,
      0,
    ),
    app.matches.value.length,
  );
  for (const group of app.fixtureGroups.value) {
    assert.ok(group.matches.every((match) => match.pool === group.pool));
  }
  app.generatePools();
  assert.equal(app.fixtureGroups.value.length, 0);
});
