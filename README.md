# @uluma/content-schema

Het gedeelde artikelmodel van Uluma: de `ContentBlock`-types, de zod-schema's die
ze op runtime bewaken, en de inline-tekstparser.

Twee projecten hangen hiervan af en dat is precies waarom dit pakket bestaat:

- **de marketingsites** (`uitblinkers-ai-web`, straks `revloft`) renderen deze
  blokken naar statische HTML;
- **Uluma Systems** (de CMS) schrijft ze.

Zouden die twee elk hun eigen kopie hebben, dan lopen ze uit elkaar — en dat merk
je niet bij het opslaan maar pas als een gepubliceerd artikel verkeerd rendert.

## Installeren

Beide consumenten installeren hetzelfde artefact op dezelfde manier:

```json
"@uluma/content-schema": "github:UlumaOnline/uluma-content-schema#v1.0.0"
```

Tag-gepind, zodat de site en de CMS onafhankelijk kunnen upgraden. Dat is geen
detail: de site kan een nieuw bloktype pas renderen als de renderer gedeployed
is, dus de CMS mag niet zomaar vooruitlopen.

`zod@^3` is een peer dependency. Níét zod 4 — dat zijn andere importpaden en je
wilt geen twee zods in één bundel.

## Wat erin zit

| Module | Inhoud |
|---|---|
| `blocks.ts` | `ContentBlock` (13 varianten), `ArticleImage`, `LevelStep`, `Step`, `zBlock`, `zStrictBlock`, `BLOCK_TYPES`, `assertNever` |
| `inline.ts` | `parseInline`, `stripInline`, `inlineHrefs`, `isExternalHref` |
| `walk.ts` | `blockInlineTexts`, `blockPlainTexts`, `blockImages`, `blockHrefs` |
| `article.ts` | `blogPostSchema()`, `newsArticleSchema()`, `strictContent()`, foutrapportage |
| `slug.ts` | `slugify`, `isValidSlug`, `uniqueSlug`, `SLUG_PATTERN` |
| `reading-time.ts` | `estimateReadingMinutes`, `countWords` |

De **types** zijn de bron, de zod-schema's staan ernaast als runtime-poort. Twee
type-niveau-checks onderaan `blocks.ts` falen bij compileren zodra die twee uit
elkaar lopen, dus je kunt er niet één aanpassen zonder de ander.

## Een bloktype toevoegen

De volgorde is opzettelijk lastig te omzeilen:

1. Voeg de variant toe aan `ContentBlock` **en** aan `zBlock` — anders faalt de
   compileercheck in `blocks.ts`.
2. Vul de `switch` in `walk.ts` aan — die is uitputtend.
3. Bump de versie, tag, push.
4. In de site: voeg een `case` toe aan `ArticleBody`. Tot je dat doet, is de
   `assertNever` in het `default`-geval een compileerfout.
5. In de CMS: voeg een entry toe aan `blockRegistry`. Dat is
   `satisfies Record<ContentBlock["type"], BlockDef>`, dus ook dat is een
   compileerfout tot het formulier bestaat.
6. **Pas als élke aangesloten site stap 4 heeft gedaan en gedeployed is:** zet
   het type in `CREATABLE_TYPES`, zodat het in het "+ blok"-menu verschijnt.

Stap 4 en 5 kunnen los in de tijd, maar geen van beide kan stilzwijgend
overgeslagen worden. Dat is het hele punt.

### Een véld toevoegen is minder goed beveiligd dan een bloktype

De stappen hierboven gaan over een nieuwe variant in `ContentBlock`. Voeg je
een veld toe aan een gedeeld type als `ArticleImage`, dan leidt geen enkele
compiler je naar de plek waar het misgaat.

Die plek is de stagingstap van de codegen. Beide sites halen hun beelden uit
Supabase Storage, verwerken ze en schrijven er een geïmporteerd asset voor
terug. De functie die dat doet bouwt zijn resultaat op als een **expliciet
objectliteral** en spreidt de databaserij niet, en dat is met opzet: de maten
uit de beeldverwerking horen die uit de database te overschrijven.

Gevolg: elk nieuw veld moet daar apart langs. Doe je dat niet, dan valt het
stilzwijgend weg — geldige JavaScript die minder teruggeeft dan de bron had,
dus geen typefout en geen melding. De faalmodus is dat de redactie zegt "ik heb
het aangezet en er gebeurt niks", en dat iedereen vervolgens in de renderer
gaat zoeken.

Dat overkwam `aiGenerated` in v1.6.0 bijna. Bij een nieuw veld hoort dus een
vijfde plek op het lijstje:

```
schema → zod → walk.ts → renderer → stagingstap van de codegen
```

De vorm die beide sites aanhouden geeft het alleen door als het iets zegt,
gelijk aan wat de view in Uluma Systems doet:

```js
...(image.aiGenerated ? { aiGenerated: true } : {}),
```

Zo blijft het gegenereerde bestand voor elk bestaand beeld byte-identiek.

### Waarom stap 6 apart staat

Dit is de enige stap in de rij die stilletjes iets kan slopen, en hij is niet
door een compiler af te dwingen — want hij speelt zich af in een andere repo
dan die waar de fout valt.

Een **veld** dat een site niet kent is onschadelijk: de zod-schema's staan op
`"strip"`, dus een onbekende sleutel wordt weggegooid en de build merkt niets.
Een **bloktype** dat een site niet kent is dat niet. `zBlock` is een
discriminated union: een onbekend `type` is geen geldig blok, `validate.mjs`
verzamelt dat als issue en de codegen stopt met `process.exit(1)`.

Het gevolg is scheef verdeeld. De redacteur die het blok kiest ziet niets
bijzonders — de CMS accepteert het, want die draait op de nieuwe versie. De
build die omvalt is die van een site waar diegene misschien niet eens aan
werkte, en de fout wijst naar een artikel dat er prima uitziet.

Daarom: het pakket mag vooruitlopen, de CMS mag een formulier hebben liggen,
maar het menu volgt als laatste.

### De compileercheck vangt ook een verouderde installatie

Minder bekend dan de kant hierboven, en het scheelt een uur zoeken.

Stap 1 tot en met 5 beschrijven wat er misgaat als een `case` ontbreekt. Maar
dezelfde poort werkt van de andere kant: staat er nog 1.5.0 in `node_modules`
terwijl je de nieuwe cases al hebt getypt, dan bestaat dat type niet in de
union die de compiler ziet. Groen blijven kan de typecheck dan niet.

**Aan de foutcode zie je welke kant van de poort je te pakken hebt**, en dat
scheelt de verkeerde reparatie:

| Foutcode | Waar | Betekenis | Oplossing |
|---|---|---|---|
| `TS2345` | op `assertNever(block, …)` | het schema is nieuwer dan je cases | case toevoegen |
| `TS2678` | op `case "steps"` zelf | je installatie is ouder dan je `package.json` | opnieuw installeren |

Nagemeten met 1.5.0 geïnstalleerd en de cases van 1.6.0 in de renderer:

```
article-body.tsx(374,10): error TS2678: Type '"steps"' is not comparable to type
  '"table" | "image" | "heading" | … | "levels"'
article-body.tsx(397,18): error TS2339: Property 'items' does not exist on type 'never'
```

Bij `TS2678` komt er een stoet `TS2339` en `TS7006` achteraan, omdat het blok
daarna op `never` narrowt. Luidruchtig, maar niet onduidelijk zolang je de
bovenste fout leest.

Dat is nuttig, want een verouderde installatie dient zich anders nergens aan.
`git checkout -- package-lock.json` zet de oude resolved commit terug en npm
honoreert die daarna zonder te klagen: je lockfile zegt dan v1.6.0 terwijl
`node_modules` op 1.5.0 blijft staan. Verversen kan met de ref er expliciet bij:

```
npm install "github:UlumaOnline/uluma-content-schema#v1.6.0"
```

En één waarschuwing die daarbij hoort: draai `npm install` in een site-repo met
de Node-versie uit hun `.nvmrc` (`fnm use 22`). De twee marketingsites draaien
op TanStack Start, en npm 11 snoeit daar `nitro/node_modules/lru-cache` weg
terwijl npm 10 op de CI-runner die regel nodig heeft. Dat valt niet lokaal om
maar pas bij `npm ci`, en de diff is duizenden regels groot zonder dat er een
foutmelding bij zit. Dit pakket zelf heeft er geen last van, en Uluma Systems
ook niet — dat is een gewone Vite-SPA zonder die geneste boom.

## Inline-opmaak

Binnen de tekst van een blok is een piepklein stukje markdown toegestaan:

```
**vet**             → <strong>
*cursief*           → <em>
++onderstreept++    → <u>
[label](/pad)       → interne link
[label](https://…)  → externe link, opent in een nieuw tabblad
```

Meer niet, en dat is een keuze: elke uitbreiding hier moet door élke renderer
gevolgd worden. `parseInline` levert tokens; wat je ermee tekent bepaal je zelf.

Drie dingen over de set die je aan de tekens niet ziet:

**`**` gaat vóór `*`.** De volgorde in het patroon is dragend; andersom knipt de
cursief-tak elk vet stuk doormidden.

**Cursief en onderstreept eisen een niet-spatie binnen de markering.** Zonder
die regel wordt `5 * 3 = 15 en 2 * 4` cursief vanaf de eerste ster. Vet heeft
die eis niet — dat gedrag ligt vast in de referentietest en veranderen zou
bestaande artikelen anders laten renderen dan ze nu doen.

**`++` en niet `__` voor onderstreept.** `__` betekent in echte markdown vet, en
dit is nadrukkelijk geen echte markdown-parser; een teken lenen dat elders iets
anders betekent maakt het verwarrend op precies de plek waar het al verwarrend
is. En let op wat onderstreepte tekst op het web betekent: dat is de conventie
voor een link. Gebruik het spaarzaam.

## Ontwikkelen

```bash
npm install     # bouwt via `prepare`
npm test        # vergelijkt parseInline met de oorspronkelijke renderInline
npm run typecheck
```

De tests draaien tegen `dist/`, dus bouw voordat je test.
