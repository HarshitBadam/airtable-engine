import { escapeLiteral } from "~/server/sql/escape";

type PopulateColumn = { id: string; type: string; name: string };

// faker.js-sourced data pools (generated via faker.seed(42)):
// pre-computed from @faker-js/faker to avoid runtime overhead.
// Pools are cycled with prime-modulo indexing in SQL ARRAY[...][1 + (idx % N)].
const FIRST_NAMES = [
  "Garnet",
  "Valentine",
  "Moses",
  "Lavinia",
  "Carley",
  "Anderson",
  "Sammie",
  "Lea",
  "Melissa",
  "Akeem",
  "Waino",
  "Riley",
  "Coy",
  "Cheyenne",
  "Christelle",
  "Elliott",
  "Judson",
  "Hollie",
  "Einar",
  "Leopoldo",
  "Brody",
  "Eladio",
  "Frederic",
  "Jacky",
  "Ozella",
  "Cody",
  "Jordane",
  "Larry",
  "Alyce",
  "Lenora",
  "Cecile",
  "Aniyah",
  "Uriel",
  "Virgil",
  "Rahsaan",
  "Ellis",
  "Axel",
  "Marlee",
  "Ignacio",
  "Bonita",
  "Jerome",
  "Alexzander",
  "Sylvia",
  "Destinee",
  "Makayla",
  "Elvie",
  "Josie",
  "Kasandra",
  "Christine",
  "Wade",
  "Ophelia",
  "Trinity",
  "Soledad",
  "Laverne",
  "Theodora",
  "Ashlynn",
  "Cletus",
  "Alvera",
  "Eriberto",
  "Gilda",
  "Donavon",
  "Rhoda",
  "Fletcher",
  "Earl",
  "Kari",
  "Brooks",
  "Princess",
  "Araceli",
  "Wyman",
  "Olin",
  "Cloyd",
  "Abner",
  "Raven",
  "Melany",
  "Montana",
  "Olen",
  "April",
  "Florida",
  "Betty",
  "Sally",
  "Linda",
  "Erwin",
  "Anibal",
  "Elva",
  "Monty",
  "Louvenia",
  "Sherwood",
  "Jaquan",
  "Blake",
  "Mia",
  "Noemie",
  "Kelli",
  "Ole",
  "Jeremy",
  "Juana",
  "Hettie",
  "Alda",
  "Bernadette",
  "Alexandrea",
  "Louie",
]; // 100

const LAST_NAMES = [
  "Lang",
  "Franey",
  "Roob",
  "Blick",
  "Crooks",
  "Schowalter",
  "Swaniawski",
  "Dibbert",
  "Lindgren",
  "Tremblay",
  "Brown",
  "Keebler",
  "Stoltenberg",
  "Langosh",
  "Fadel",
  "Hauck",
  "Hand",
  "Prosacco",
  "Witting",
  "Graham",
  "Monahan",
  "Bechtelar",
  "Upton",
  "Considine",
  "Yost",
  "Osinski",
  "Ferry",
  "Hilll",
  "Nader",
  "Borer",
  "Hammes",
  "Bauch",
  "Pagac",
  "Langworth",
  "Pollich",
  "Wehner",
  "Heaney",
  "Walsh",
  "Gerlach",
  "Schumm",
  "Lehner",
  "Botsford",
  "Tromp",
  "Hayes",
  "Reinger",
  "Torphy",
  "Nitzsche",
  "Moen",
  "Bradtke",
  "Abshire",
  "Lowe",
  "Rath",
  "Hane",
  "Oberbrunner",
  "Gleason",
  "Wiza",
  "Toy",
  "Schimmel",
  "Mayer",
  "Dietrich",
  "Goyette",
  "Weimann",
  "Ward",
  "Wisoky",
  "Stark",
  "Weber",
  "Marks",
  "Morar",
  "Robel",
  "Greenholt",
  "Schroeder",
  "Veum",
  "Kuvalis",
  "Schinner",
  "Bashirian",
  "Littel",
  "McLaughlin",
  "Hessel",
  "Ledner",
  "Emmerich",
  "Bogan",
  "Lemke",
  "Nienow",
  "Wolf",
  "Goldner",
  "Block",
  "Windler",
  "Predovic",
  "Dach",
  "Barton",
  "Runte",
  "Jakubowski",
  "Hartmann",
  "Beier",
  "Hoeger",
  "Hermann",
]; // 97

const CATCH_PHRASES = [
  "Decentralized demand-driven knowledge base",
  "Reactive national database",
  "User-friendly real-time knowledge user",
  "Polarised heuristic core",
  "Grass-roots regional access",
  "Cross-platform analyzing algorithm",
  "Sustainable optimal infrastructure",
  "Compatible immersive infrastructure",
  "Digitized high-level functionalities",
  "Polarised modular alliance",
  "Immersive mobile instruction set",
  "Sustainable national capability",
  "Business-focused motivating adapter",
  "Persistent value-added local area network",
  "Implemented motivating hub",
  "Organic value-added framework",
  "User-friendly transitional collaboration",
  "Business-focused bifurcated access",
  "Compatible neutral application",
  "Fully-configurable system-worthy adapter",
  "Sharable disintermediate artificial intelligence",
  "Quality-focused mobile strategy",
  "Reduced secondary database",
  "Digitized reciprocal projection",
  "Visionary global frame",
  "Seamless executive task-force",
  "Sustainable high-level portal",
  "Robust bottom-line support",
  "Open-source static encryption",
  "Total fresh-thinking access",
  "Triple-buffered bifurcated encryption",
  "User-centric well-modulated local area network",
  "Profit-focused holistic definition",
  "Fundamental needs-based portal",
  "Self-enabling scalable architecture",
  "Open-source asymmetric knowledge base",
  "Managed tertiary focus group",
  "Cross-platform client-server pricing structure",
  "Proactive bifurcated architecture",
  "Quality-focused asynchronous protocol",
  "Reactive attitude-oriented architecture",
  "Virtual fault-tolerant frame",
  "Sharable well-modulated website",
  "Robust fault-tolerant architecture",
  "Seamless leading edge hardware",
  "Triple-buffered bottom-line installation",
  "AI-driven human-resource analyzer",
  "Cross-platform clear-thinking model",
  "Reverse-engineered logistical toolset",
  "Immersive disintermediate strategy",
  "Ergonomic zero administration access",
  "Versatile actuating success",
  "Optimized zero trust approach",
  "Organic zero defect internet solution",
  "Proactive next generation hub",
  "Proactive maximized support",
  "Automated disintermediate time-frame",
  "Total homogeneous microservice",
  "Face to face composite implementation",
  "Grass-roots logistical approach",
  "Versatile zero tolerance open architecture",
  "Optional eco-centric projection",
  "Public-key coherent synergy",
  "Smart well-modulated parallelism",
  "Polarised heuristic task-force",
  "Synchronised analyzing adapter",
  "Immersive stable website",
  "Decentralized maximized framework",
  "Versatile sustainable software",
  "Multi-tiered global data-warehouse",
  "Balanced systematic projection",
  "Visionary zero trust knowledge user",
  "Seamless well-modulated solution",
  "Expanded homogeneous attitude",
  "User-friendly methodical conglomeration",
  "Progressive mobile forecast",
  "Cross-platform needs-based interface",
  "Seamless intangible solution",
  "Organic leading edge strategy",
]; // 79

// faker.js free_email domains (faker.definitions.internet.free_email)
const EMAIL_PROVIDERS = [
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "icloud.com",
  "protonmail.com",
  "aol.com",
  "mail.com",
  "zoho.com",
  "fastmail.com",
  "yandex.com",
  "tutanota.com",
  "gmx.com",
]; // 13

const FILE_EXTS = [
  "pdf",
  "docx",
  "xlsx",
  "png",
  "jpg",
  "csv",
  "txt",
  "pptx",
  "zip",
  "svg",
]; // 10
const FILE_PREFIXES = [
  "report",
  "invoice",
  "presentation",
  "document",
  "spreadsheet",
  "summary",
  "analysis",
  "proposal",
  "contract",
  "memo",
  "brief",
  "overview",
  "review",
  "draft",
  "plan",
  "notes",
  "agenda",
  "schedule",
  "budget",
  "forecast",
]; // 20

// SQL helper: builds ARRAY[...][1 + ((idx) % len)]
function sqlArrayPick(arr: string[], idxExpr: string): string {
  const escaped = arr.map((s) => `'${s.replace(/'/g, "''")}'`).join(",");
  return `(ARRAY[${escaped}])[1 + ((${idxExpr}) % ${arr.length})]`;
}

/**
 * Builds the `jsonb_build_object(...)` and search-text SQL expressions used
 * by addMany's `INSERT ... SELECT ... FROM generate_series` to populate new
 * rows with realistic-looking synthetic data.
 *
 * `batchStart` is folded into the returned SQL as a literal (it changes per
 * insert batch); `gs` refers to the `generate_series` alias in the caller's
 * query, so the per-row cycling index (`idx`) is `batchStart + gs`,
 * evaluated by Postgres once per generated row — this function only ever
 * runs once per batch, not once per row.
 *
 * When `columns` is empty (population disabled, or a table with no
 * columns), returns the empty-cell defaults instead of building SQL.
 */
export function buildPopulatedRowSql(
  columns: PopulateColumn[],
  batchStart: number,
): { cellsExpr: string; searchExpr: string } {
  if (columns.length === 0) {
    return { cellsExpr: "'{}'::jsonb", searchExpr: "''::text" };
  }

  const jsonbParts: string[] = [];
  const searchParts: string[] = [];
  const colNameLower = (n: string) => n.toLowerCase().trim();

  // Use different prime multipliers per field so combinations don't align.
  // idx is the absolute row index: batchStart + gs
  const idx = `(${batchStart} + gs)`;

  for (const col of columns) {
    const colId = escapeLiteral(col.id);
    const name = colNameLower(col.name);

    if (col.type === "NUMBER") {
      jsonbParts.push(`'${colId}', (${batchStart} + gs)`);
      searchParts.push(`(${batchStart} + gs)::text`);
    } else if (name === "name") {
      const expr = `${sqlArrayPick(FIRST_NAMES, idx)} || ' ' || ${sqlArrayPick(LAST_NAMES, `${idx} * 7 + 3`)}`;
      jsonbParts.push(`'${colId}', ${expr}`);
      searchParts.push(expr);
    } else if (name === "notes") {
      const expr = sqlArrayPick(CATCH_PHRASES, `${idx} * 3 + 1`);
      jsonbParts.push(`'${colId}', ${expr}`);
      searchParts.push(expr);
    } else if (name === "assignee") {
      const expr = `lower(${sqlArrayPick(FIRST_NAMES, `${idx} * 11 + 5`)}) || '.' || lower(${sqlArrayPick(LAST_NAMES, `${idx} * 13 + 7`)}) || '@' || ${sqlArrayPick(EMAIL_PROVIDERS, `${idx} * 17 + 2`)}`;
      jsonbParts.push(`'${colId}', ${expr}`);
      searchParts.push(expr);
    } else if (name === "status") {
      const expr = sqlArrayPick(
        ["Todo", "In progress", "In review", "Done", "Blocked"],
        idx,
      );
      jsonbParts.push(`'${colId}', ${expr}`);
      searchParts.push(expr);
    } else if (name === "attachments") {
      const expr = `'https://storage.example.com/' || ${sqlArrayPick(FILE_PREFIXES, `${idx} * 3`)} || '-' || ${idx} || '.' || ${sqlArrayPick(FILE_EXTS, `${idx} * 7`)}`;
      jsonbParts.push(`'${colId}', ${expr}`);
      searchParts.push(expr);
    } else {
      const expr = `${sqlArrayPick(FIRST_NAMES, `${idx} * 3`)} || ' ' || ${sqlArrayPick(LAST_NAMES, `${idx} * 5 + 1`)}`;
      jsonbParts.push(`'${colId}', ${expr}`);
      searchParts.push(expr);
    }
  }

  return {
    cellsExpr: `jsonb_build_object(${jsonbParts.join(", ")})`,
    searchExpr: searchParts.join(` || chr(31) || `),
  };
}
