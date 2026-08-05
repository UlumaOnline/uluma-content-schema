/**
 * Slugs. Het formaat is met opzet krap: kleine letters, cijfers en enkele
 * koppeltekens, geen accenten en geen koppelteken aan begin of eind. Dezelfde
 * regel staat als CHECK-constraint op de `articles`-tabel, zodat een slug die
 * hier doorkomt ook door de database komt en andersom.
 */

/** Hetzelfde patroon als de CHECK-constraint `articles_slug_format`. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}

/**
 * Maakt van een titel een slug. Accenten worden gestript via Unicode-normalisatie
 * (`café` → `cafe`), maar de Duitse ß en de Nederlandse ĳ hebben geen losse
 * accenttekens en worden apart afgehandeld.
 *
 * Dit is een startvoorstel voor de redacteur, geen automatisme: de slug is een
 * permanente URL en verdient een blik. In de editor staat hij dan ook in een
 * bewerkbaar veld en niet achter een slotje.
 */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ĳ/g, "ij")
    .replace(/Ĳ/g, "IJ")
    .replace(/ß/g, "ss")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Voegt een teller toe tot de slug vrij is. `taken` bevat de bestaande slugs
 * binnen dezelfde site, soort én taal — dat is precies de reikwijdte van de
 * unieke index in de database.
 */
export function uniqueSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!used.has(candidate)) return candidate;
  }
}
