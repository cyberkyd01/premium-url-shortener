import { db } from "./db";
import { unstable_cache } from "next/cache";
import en from "@/locales/en.json";

export type Dict = Record<string, string>;

const loadLang = unstable_cache(
  async (code: string): Promise<Dict> => {
    const lang = await db.language.findUnique({ where: { code }, include: { strings: true } });
    const out: Dict = { ...(en as Dict) };
    if (lang) for (const s of lang.strings) out[s.key] = s.value;
    return out;
  },
  ["lang"],
  { tags: ["translations"], revalidate: 600 },
);

export async function getDictionary(code = "en") {
  return loadLang(code);
}

/** t("key", {name:"x"}) with fallback to the key text itself. */
export function translator(dict: Dict) {
  return (key: string, vars?: Record<string, string | number>) => {
    let s = dict[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    return s;
  };
}

export async function getActiveLanguages() {
  return db.language.findMany({ where: { active: true }, orderBy: { name: "asc" } });
}
