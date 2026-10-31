// Vue is loaded by index.html. Keep all tournament state inside setup().
const { createApp, ref, reactive, computed } = Vue;
createApp({
  setup() {
    // Team defaults and preference options
    const emoji = [
      "🦁",
      "🐯",
      "🦅",
      "🐉",
      "🐺",
      "🦈",
      "🐻",
      "🦂",
      "🦊",
      "🦏",
      "🦍",
      "🐆",
      "🐊",
      "🦬",
      "🦉",
      "🐝",
      "🐘",
      "🦇",
      "🐢",
      "🦜",
      "🦚",
      "🐬",
      "🦌",
      "🐙",
      "⚡",
      "🔥",
      "🌪️",
      "🚀",
      "💎",
      "👑",
      "🏹",
      "🛡️",
    ];
    const preferences = [
      { value: "none", label: "No preference" },
      { value: "consecutive", label: "3 consecutive matches" },
      { value: "early", label: "Early morning" },
      { value: "last", label: "Play last match of pool" },
      { value: "late", label: "Later matches" },
      { value: "break", label: "Break between matches" },
      { value: "after9", label: "After 9 AM" },
      { value: "after10", label: "After 10 AM" },
    ];
    const settings = reactive({
      teamCount: 24,
      poolCount: 6,
      grounds: 2,
      startTime: "08:00",
      matchMinutes: 40,
      gapMinutes: 5,
      morningCutoff: "10:00",
    });
    const makeTeam = (i) => ({
      id: i + 1,
      name: `Team ${i + 1}`,
      rating: 100 - i,
      preference: "none",
      required: false,
      icon: emoji[i % emoji.length],
    });
    const teams = ref(Array.from({ length: 24 }, (_, i) => makeTeam(i)));
    const pools = ref([]),
      matches = ref([]),
      warnings = ref([]),
      tab = ref("setup"),
      importMessage = ref("");

    // Both schedule layouts read from the same live match data.
    const scheduleView = ref("poster");
    const fixtureGroups = computed(() =>
      pools.value
        .map((_, i) => {
          const name = poolName(i);
          return {
            pool: name,
            matches: matches.value.filter((match) => match.pool === name),
          };
        })
        .filter((group) => group.matches.length),
    );

    // Team editing
    function resizeTeams() {
      const n = Math.max(
        2,
        Math.min(128, Math.floor(Number(settings.teamCount) || 2)),
      );
      settings.teamCount = n;
      teams.value = Array.from(
        { length: n },
        (_, i) => teams.value[i] || makeTeam(i),
      );
      pools.value = [];
      matches.value = [];
    }
    function randomizeIcons() {
      const shuffled = [...emoji].sort(() => Math.random() - 0.5);
      teams.value.forEach((t, i) => (t.icon = shuffled[i % shuffled.length]));
    }

    // Balanced pool generation
    function poolName(i) {
      let s = "";
      for (let x = i + 1; x > 0; x = Math.floor((x - 1) / 26))
        s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
      return s;
    }
    function generatePools() {
      if (
        teams.value.some(
          (t) => !t.name.trim() || !Number.isFinite(Number(t.rating)),
        )
      ) {
        importMessage.value = "All teams need a name and numeric rating.";
        tab.value = "setup";
        return;
      }
      importMessage.value = "";
      const n = Math.max(
        1,
        Math.min(
          26,
          teams.value.length,
          Math.floor(Number(settings.poolCount) || 1),
        ),
      );
      settings.poolCount = n;
      const sorted = [...teams.value].sort(
        (a, b) => Number(b.rating) - Number(a.rating) || a.id - b.id,
      );
      const out = Array.from({ length: n }, () => []);
      sorted.forEach((t, i) => {
        const row = Math.floor(i / n),
          pos = i % n;
        out[row % 2 === 0 ? pos : n - 1 - pos].push(t);
      });
      // Keep the strongest and weakest seeds apart, preserving pool sizes.
      // A single pool cannot satisfy this tournament rule.
      if (n === 1 && sorted.length > 1) {
        pools.value = [];
        matches.value = [];
        warnings.value = [];
        importMessage.value =
          "Use at least 2 pools to keep the highest- and lowest-ranked teams apart.";
        tab.value = "setup";
        return;
      }
      const strongest = sorted[0];
      const weakest = sorted[sorted.length - 1];
      const strongestPool = out.findIndex((pool) => pool.includes(strongest));
      const weakestPool = out.findIndex((pool) => pool.includes(weakest));
      if (strongestPool === weakestPool && sorted.length > 1) {
        const totals = out.map((pool) =>
          pool.reduce((sum, team) => sum + Number(team.rating), 0),
        );
        let bestSwap;
        for (let poolIndex = 0; poolIndex < out.length; poolIndex++) {
          if (poolIndex === strongestPool) continue;
          for (
            let teamIndex = 0;
            teamIndex < out[poolIndex].length;
            teamIndex++
          ) {
            const candidate = out[poolIndex][teamIndex];
            const difference =
              Number(candidate.rating) - Number(weakest.rating);
            const nextTotals = totals.map(
              (total, index) =>
                total +
                (index === strongestPool
                  ? difference
                  : index === poolIndex
                    ? -difference
                    : 0),
            );
            const spread = Math.max(...nextTotals) - Math.min(...nextTotals);
            if (!bestSwap || spread < bestSwap.spread) {
              bestSwap = { poolIndex, teamIndex, spread };
            }
          }
        }
        const weakestIndex = out[strongestPool].indexOf(weakest);
        const candidate = out[bestSwap.poolIndex][bestSwap.teamIndex];
        out[strongestPool][weakestIndex] = candidate;
        out[bestSwap.poolIndex][bestSwap.teamIndex] = weakest;
      }
      pools.value = out;
      matches.value = [];
      warnings.value = [];
      tab.value = "pools";
    }

    // Fixture generation and preference scoring
    function fixtures(pool) {
      const a = [];
      for (let i = 0; i < pool.length; i++)
        for (let j = i + 1; j < pool.length; j++)
          a.push({ home: pool[i], away: pool[j] });
      return a;
    }
    function positions(order, id) {
      return order.flatMap((m, i) =>
        m.home.id === id || m.away.id === id ? [i] : [],
      );
    }
    function check(team, order, base = 0, duration = 0) {
      const p = positions(order, team.id),
        kind = team.preference;
      if (kind === "consecutive") return p.length === 3 && p[2] - p[0] === 2;
      if (kind === "last") return p.includes(order.length - 1);
      if (kind === "break")
        return p.every((v, i) => i === 0 || v - p[i - 1] > 1);
      if (kind === "early") return p[0] <= 1;
      if (kind === "late")
        return p[0] >= Math.max(1, Math.floor(order.length / 2));
      if (kind === "after9" || kind === "after10") {
        const threshold = kind === "after9" ? 9 * 60 : 10 * 60;
        return p.length > 0 && p.every((i) => base + i * duration >= threshold);
      }
      return true;
    }
    function score(order, pool, base, duration) {
      return pool.reduce(
        (s, t) =>
          s +
          (t.preference === "none"
            ? 0
            : check(t, order, base, duration)
              ? t.required
                ? 100
                : 10
              : t.required
                ? -1000
                : -10),
        0,
      );
    }
    function bestOrder(pool, base, duration) {
      const a = fixtures(pool);
      if (a.length > 7) {
        return a;
      }
      let best = a,
        bestScore = -Infinity;
      function search(prefix, left) {
        if (!left.length) {
          let value = score(prefix, pool, base, duration);
          if (value > bestScore) {
            bestScore = value;
            best = prefix.slice();
          }
          return;
        }
        for (let i = 0; i < left.length; i++)
          search(
            [...prefix, left[i]],
            [...left.slice(0, i), ...left.slice(i + 1)],
          );
      }
      search([], a);
      return best;
    }
    function toMin(s) {
      const [h, m] = s.split(":").map(Number);
      return h * 60 + m;
    }
    function formatTime(n) {
      const mins = ((n % 1440) + 1440) % 1440;
      const hh = Math.floor(mins / 60);
      return `${String(hh).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}${n >= 1440 ? " (+1 day)" : ""}`;
    }
    function generateSchedule() {
      if (!pools.value.length) generatePools();
      if (!pools.value.length) return;
      const groundCount = Math.max(
        1,
        Math.min(24, Math.floor(Number(settings.grounds) || 1)),
      );
      const duration =
        Math.max(1, Number(settings.matchMinutes) || 40) +
        Math.max(0, Number(settings.gapMinutes) || 0);
      const clocks = Array(groundCount).fill(toMin(settings.startTime));
      const out = [],
        notes = [];
      const indexed = pools.value
        .map((pool, i) => ({
          pool,
          i,
          early: pool.filter((t) => t.preference === "early").length,
        }))
        .sort((a, b) => b.early - a.early || a.i - b.i);
      for (const { pool, i } of indexed) {
        const ground = clocks.indexOf(Math.min(...clocks)),
          base = clocks[ground],
          order = bestOrder(pool, base, duration);
        order.forEach((m, j) =>
          out.push({
            pool: poolName(i),
            ground: ground + 1,
            start: base + j * duration,
            home: m.home,
            away: m.away,
          }),
        );
        clocks[ground] = base + order.length * duration;
        for (const t of pool) {
          if (t.preference !== "none" && !check(t, order, base, duration))
            notes.push(
              `${t.name}: ${t.preference} preference not met${t.required ? " (required)" : ""}`,
            );
          if (t.preference === "early" && base > toMin(settings.morningCutoff))
            notes.push(
              `${t.name}: pool begins after morning cutoff (${settings.morningCutoff})`,
            );
        }
      }
      out.sort((a, b) => a.start - b.start || a.ground - b.ground);
      out.forEach((m, i) => (m.id = i + 1));
      if (clocks.some((c) => c >= 1440))
        notes.push(
          "The schedule extends past midnight. Consider extra grounds or multiple tournament days.",
        );
      matches.value = out;
      warnings.value = notes;
      tab.value = "schedule";
    }

    // CSV parsing and preference normalization
    function parseCSV(text) {
      const rows = [];
      let row = [],
        field = "",
        quotes = false;
      for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (c === '"') {
          if (quotes && text[i + 1] === '"') {
            field += '"';
            i++;
          } else quotes = !quotes;
        } else if (c === "," && !quotes) {
          row.push(field);
          field = "";
        } else if ((c === "\n" || c === "\r") && !quotes) {
          if (c === "\r" && text[i + 1] === "\n") i++;
          row.push(field);
          if (row.some((x) => x.trim())) rows.push(row);
          row = [];
          field = "";
        } else field += c;
      }
      row.push(field);
      if (row.some((x) => x.trim())) rows.push(row);
      if (quotes) throw Error("Unclosed CSV quote");
      return rows;
    }
    function preferenceDistance(a, b) {
      let row = Array.from({ length: b.length + 1 }, (_, i) => i);
      for (let i = 1; i <= a.length; i++) {
        const next = [i];
        for (let j = 1; j <= b.length; j++)
          next[j] = Math.min(
            next[j - 1] + 1,
            row[j] + 1,
            row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
          );
        row = next;
      }
      return row[b.length];
    }
    function mapPreference(raw) {
      const text = String(raw || "")
        .toLowerCase()
        .replace(/a\s*\.\s*m\.?/g, "am")
        .replace(/p\s*\.\s*m\.?/g, "pm")
        .replace(/[-_]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      const aliases = {
        none: [
          "none",
          "no preference",
          "any",
          "any time",
          "anytime",
          "flexible",
          "n/a",
          "na",
        ],
        consecutive: [
          "consecutive",
          "3 consecutive matches",
          "three consecutive matches",
          "back to back",
          "back to back matches",
          "continuous matches",
        ],
        early: [
          "early",
          "early morning",
          "morning",
          "morning matches",
          "first matches",
        ],
        last: [
          "last",
          "play last match of pool",
          "last match",
          "last match of pool",
          "final pool match",
        ],
        late: ["late", "later matches", "late matches", "afternoon", "evening"],
        break: [
          "break",
          "break between matches",
          "break between games",
          "gap between matches",
          "with breaks",
          "rest between matches",
        ],
        after9: [
          "after9",
          "after 9 am",
          "after 9",
          "after 9:00 am",
          "after nine am",
        ],
        after10: [
          "after10",
          "after 10 am",
          "after 10",
          "after 10:00 am",
          "after ten am",
        ],
      };
      if (!text) return { value: "none", approximate: false };
      for (const [value, phrases] of Object.entries(aliases))
        if (phrases.includes(text)) return { value, approximate: false };
      // Approximate only explicit morning start times. Keep unsupported hours visible for review.
      const time = text.match(
        /^(?:after|from|not before|no earlier than)\s*(\d{1,2})(?::([0-5]\d))?\s*(am)?$/,
      );
      if (time) {
        const hour = Number(time[1]);
        if (hour >= 8 && hour <= 11) {
          const minutes = hour * 60 + Number(time[2] || 0);
          const value =
            Math.abs(minutes - 540) < Math.abs(minutes - 600)
              ? "after9"
              : "after10";
          const approximate = minutes !== (value === "after9" ? 540 : 600);
          return { value, approximate };
        }
      }
      const ranked = Object.entries(aliases)
        .map(([value, phrases]) => ({
          value,
          distance: Math.min(
            ...phrases.map(
              (p) =>
                preferenceDistance(text, p) / Math.max(text.length, p.length),
            ),
          ),
        }))
        .sort((a, b) => a.distance - b.distance);
      if (
        text.length >= 4 &&
        ranked[0].distance <= 0.22 &&
        ranked[1].distance - ranked[0].distance >= 0.1 &&
        !/\d|\b(?:not|no|without|before|after|am|pm)\b/.test(text)
      )
        return { value: ranked[0].value, approximate: true };
      throw Error(
        `Cannot confidently match preference "${raw}". Use: ${preferences.map((p) => p.value).join(", ")}`,
      );
    }

    // CSV import: validate all rows before replacing the roster
    async function importCSV(e) {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const rows = parseCSV(await file.text());
        if (rows.length < 2)
          throw Error("CSV needs headers and at least one team");
        const heads = rows.shift().map((x) => x.trim().toLowerCase());
        const get = (r, k) => r[heads.indexOf(k)]?.trim();
        if (!heads.includes("name") || !heads.includes("rating"))
          throw Error("CSV must include name and rating columns");
        const mappingNotes = [];
        const newTeams = rows.map((r, i) => {
          const name = get(r, "name");
          const rating = Number(get(r, "rating"));
          if (!name || !Number.isFinite(rating))
            throw Error(`Invalid name or rating on CSV row ${i + 2}`);
          const rawPref = get(r, "preference") || "none";
          let mapped;
          try {
            mapped = mapPreference(rawPref);
          } catch (err) {
            throw Error(`Row ${i + 2}: ${err.message}`);
          }
          const pref = mapped.value;
          const required = /^(true|yes|1)$/i.test(get(r, "required") || "");
          if (mapped.approximate && required)
            throw Error(
              `Row ${i + 2}: "${rawPref}" is only an approximate match for "${pref}". Choose an exact preference for this hard constraint.`,
            );
          if (rawPref.toLowerCase() !== pref)
            mappingNotes.push(
              `Row ${i + 2} (${name}): "${rawPref}" → ${preferences.find((p) => p.value === pref).label}${mapped.approximate ? " (approximate; review)" : ""}`,
            );
          return {
            ...makeTeam(i),
            name,
            rating,
            preference: pref,
            required,
            icon:
              get(r, "icon") || emoji[Math.floor(Math.random() * emoji.length)],
          };
        });
        if (newTeams.length < 2 || newTeams.length > 128)
          throw Error("Upload 2–128 teams");
        teams.value = newTeams;
        settings.teamCount = newTeams.length;
        pools.value = [];
        matches.value = [];
        importMessage.value = `Imported ${newTeams.length} teams successfully.${mappingNotes.length ? " Preference mappings: " + mappingNotes.join("; ") : ""}`;
      } catch (err) {
        importMessage.value = `Import error: ${err.message}`;
      }
      e.target.value = "";
    }

    // CSV exports and downloads
    function csvRow(fields) {
      return fields
        .map((x) => '"' + String(x ?? "").replaceAll('"', '""') + '"')
        .join(",");
    }
    function download(text, filename) {
      const a = document.createElement("a"),
        url = URL.createObjectURL(
          new Blob([text], { type: "text/csv;charset=utf-8" }),
        );
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    function downloadSample() {
      download(
        [
          csvRow(["name", "rating", "preference", "required", "icon"]),
          csvRow(["Royal Strikers", 98, "early", "false", "🦁"]),
          csvRow(["Thunder XI", 94, "consecutive", "true", "⚡"]),
          csvRow(["Falcons", 90, "last", "false", "🦅"]),
        ].join("\r\n"),
        "teams-template.csv",
      );
    }
    function exportTeams() {
      download(
        [
          csvRow(["name", "rating", "preference", "required", "icon"]),
          ...teams.value.map((t) =>
            csvRow([t.name, t.rating, t.preference, t.required, t.icon]),
          ),
        ].join("\r\n"),
        "teams.csv",
      );
    }
    function exportSchedule() {
      download(
        [
          csvRow(["match", "time", "ground", "pool", "team1", "team2"]),
          ...matches.value.map((m) =>
            csvRow([
              m.id,
              formatTime(m.start),
              m.ground,
              m.pool,
              m.home.name,
              m.away.name,
            ]),
          ),
        ].join("\r\n"),
        "schedule.csv",
      );
    }
    return {
      teams,
      pools,
      matches,
      warnings,
      tab,
      settings,
      preferences,
      importMessage,
      resizeTeams,
      randomizeIcons,
      poolName,
      generatePools,
      generateSchedule,
      importCSV,
      downloadSample,
      exportTeams,
      exportSchedule,
      scheduleView,
      fixtureGroups,
      formatTime,
    };
  },
}).mount("#app");
