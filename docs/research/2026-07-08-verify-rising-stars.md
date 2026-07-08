# Rising-stars watchlist — fact-check (2026-07-08)

**Summary: 48 drivers checked · 46 CONFIRMED · 2 WRONG · 0 OUTDATED · 0 UNVERIFIABLE.** Plus 3 non-load-bearing factual errors and 4 label/staleness advisories flagged for the editor (see below).

Scope: verified the TWO load-bearing claims per driver — (a) the headline claim (first `highlights` entry) and (b) the `academy` affiliation — for all 48 entries in `content/information/rising-stars.json`. Current as of 2026-07-08. Championship-position facts checked against final classifications; 2026-season claims checked against current news.

## WRONG — fix before promoting (both are final-standings position errors)

Note: the dataset also contains an internal contradiction here — it lists BOTH Tsolov and Boya as "Third in the 2025 FIA Formula 3 Championship". Boya was 3rd; Tsolov was 2nd.

- **nikola-tsolov — WRONG** — Claim "Third in the 2025 FIA Formula 3 Championship" is incorrect: he finished **2nd (runner-up), 124 pts**; Mari Boya was 3rd (116 pts). Câmara champion (166). (Boya had held 2nd going into Monza; Tsolov's P2 in the finale moved him ahead.) Red Bull Junior Team academy is correct. Sources: https://en.wikipedia.org/wiki/2025_FIA_Formula_3_Championship , https://www.fia.com/events/fia-formula-3-championship/season-2025/2025-standings
- **luke-browning — WRONG** — Claim "Third in the 2025 FIA Formula 2 Championship" is incorrect: he finished **4th, 162 pts**; Richard Verschoor was 3rd (170 pts). Williams Driver Academy is correct. (A stale FIA snapshot circulating with lower totals shows Browning 3rd/161 — the final classification per motorsport.com is Verschoor 3rd/170, Browning 4th/162.) Source: https://www.motorsport.com/fia-f2/standings/2025/

## Secondary factual errors — not the two load-bearing claims, but should be corrected

These drivers are CONFIRMED on headline + academy, but have a wrong fact elsewhere in their entry:

- **alessandro-giusti** — later highlight "Sixth in the 2025 FIA Formula 3 Championship" is wrong: he finished **10th (67 pts)** in 2025 F3. (6th was his 2023 FRECA rookie year.) Source: https://en.wikipedia.org/wiki/Alessandro_Giusti
- **rashid-al-dhaheri** — "Runner-up in Formula Regional Middle East 2025" is misdated: the runner-up finish was **2026** (R-ace GP); in 2025 FRME he was 6th (Mumbai Falcons). Also, he already raced FRECA in 2025 (Prema), so "steps up to FRECA for 2026" is a continuation, not a step-up. Source: https://en.wikipedia.org/wiki/Rashid_Al_Dhaheri
- **corey-heim** — "Record-tying nine Truck wins in 2025" understates it: he won **12 races, an outright new single-season Truck record** (broke Biffle's 1999 mark of nine). Champion + Toyota/TRD affiliation are correct. Source: https://www.nascar.com/news-media/2025/10/31/corey-heim-caps-off-historic-season-as-2025-craftsman-truck-series-champion/

## Advisories — label precision / stale metadata (not errors in the two claims)

- **paul-aron** — academy field "Alpine Academy" is imprecise: Alpine lists him as **Test & Reserve Driver** (a senior F1 role), not a junior academy member. Both load-bearing claims substantively confirmed. Source: https://www.alpinef1.com/drivers/paul-aron
- **doriane-pin** — academy "Mercedes Junior Programme" is superseded: she **graduated to Mercedes-AMG F1 Development Driver for 2026** (the headline already notes this). Source: https://www.mercedesamgf1.com/news/doriane-graduates-to-development-driver-role
- **arvid-lindblad / scott-lindblom / chiara-battig** — `currentSeries` field is stale: Lindblad has been promoted to F1 with Racing Bulls (his own highlight notes it); Lindblom and Bättig both moved from Karting to **British F4 for 2026** (with Hitech).
- **noah-stromsted** — `academy: null` is an omission (not a false claim): he was a **2025 Mercedes Junior Team** member. Headline (6th in 2025 F3) is correct.

## CONFIRMED (both load-bearing claims accurate)

- leonardo-fornaroli — CONFIRMED — 2025 F2 champion as rookie with Invicta (211 pts); McLaren junior for 2026.
- jak-crawford — CONFIRMED — 2025 F2 runner-up (175 pts, DAMS); Aston Martin Aramco academy / F1 third driver.
- alex-dunne — CONFIRMED — 5th in 2025 F2 as rookie (150 pts), two feature wins; joined Alpine Academy for 2026.
- arvid-lindblad — CONFIRMED — 6th in 2025 F2 as rookie (134 pts); Red Bull Junior Team. (See stale-metadata advisory.)
- dino-beganovic — CONFIRMED — 2022 FRECA champion; Ferrari Driver Academy.
- rafael-camara — CONFIRMED — 2025 F3 champion as rookie with Trident; Ferrari Driver Academy.
- gabriele-mini — CONFIRMED — Alpine Academy since 2023; F2 2026 with MP Motorsport.
- mari-boya — CONFIRMED — 3rd in 2025 F3 with Campos; first Aston Martin Aramco academy signing.
- martinius-stenshorne — CONFIRMED — 5th in 2025 F3 with two wins; academy null correct (left McLaren end of 2025).
- sebastian-montoya — CONFIRMED — son of two-time Indy 500 winner Juan Pablo Montoya; F2 2026 with Prema; academy null correct.
- tuukka-taponen — CONFIRMED — Ferrari Driver Academy since 2023; F3 2026 with MP Motorsport.
- ugo-ugochukwu — CONFIRMED — McLaren junior 2021–Nov 2025 with multiple junior titles; academy null correct; leads 2026 F3 with Campos.
- james-wharton — CONFIRMED — maiden F3 win at 2025 Spielberg sprint; academy null correct (ex-Ferrari junior, left end of 2023).
- fionn-mclaughlin — CONFIRMED — 2025 British F4 champion + Rookie Cup in rookie car season; Red Bull Junior Team.
- alessandro-giusti — CONFIRMED (headline + academy) — 2022 French F4 champion; Williams Driver Academy. (See secondary error re: F3 position.)
- freddie-slater — CONFIRMED — 2025 FRECA champion with Prema; Audi Driver Development Programme's first signing.
- matteo-de-palo — CONFIRMED — 2025 FRECA runner-up; joined McLaren DDP Nov 2025.
- kean-nakamura-berta — CONFIRMED — 2025 Italian F4 champion with Prema; Williams Driver Academy.
- rashid-al-dhaheri — CONFIRMED (headline + academy) — Mercedes junior; in FREC 2026. (See secondary error re: FRME year.)
- christian-costoya — CONFIRMED — McLaren DDP member (joined Dec 2025); graduates to F4 in 2026.
- dries-van-langendonck — CONFIRMED — McLaren DDP member; 2026 Formula Winter Series champion.
- ethan-jeff-hall — CONFIRMED — 2024 FIA Karting OK world champion; 2026 Mercedes Junior Programme.
- kenzo-craigie — CONFIRMED — 2024 FIA Karting OK-Junior world champion; Mercedes Junior Programme.
- salim-hanna — CONFIRMED — 2025 Italian F4 Rookie champion with Prema; academy null correct (Prema protégé only).
- thomas-strauven — CONFIRMED — 2025 F4 Spanish champion with Campos (Griffin Core by Campos), clinched with five races to spare; academy null correct.
- enzo-deligny — CONFIRMED — 3rd in 2025 FRECA; academy null correct (ex-Red Bull junior, dropped after 2024).
- noah-baglin — CONFIRMED — 2025 FIA Karting OK-Junior world champion; Ferrari Driver Academy (joined 2025).
- thibaut-ramaekers — CONFIRMED — 2025 FIA Karting senior OK world champion, first Belgian OK champ in ~50 years; academy null correct.
- filippo-sala — CONFIRMED — Ferrari Driver Academy (announced Apr 2025).
- scott-lindblom — CONFIRMED — joined Red Bull Junior Team Aug 2024 via Red Bull Driver Search; still RBJT. (See stale-metadata advisory.)
- chiara-battig — CONFIRMED — Swiss karting champion (3x OK-J); on Red Bull Junior Team (joined Aug 2025). (See stale-metadata advisory.)
- harry-williams — CONFIRMED — McLaren's youngest-ever DDP signing at age 11 (April 2026).
- dean-hoogendoorn — CONFIRMED — 2025 FIA Karting European OK-Junior champion; Williams Driver Academy.
- doriane-pin — CONFIRMED — 2025 F1 Academy champion with Prema; named Mercedes F1 development driver for 2026. (See label advisory.)
- alba-larsen — CONFIRMED — Ferrari Driver Academy (joined Aug 2025); Ferrari's F1 Academy entry for 2026 with MP Motorsport.
- ella-lloyd — CONFIRMED — McLaren DDP member; McLaren's F1 Academy driver (Rodin Motorsport).
- nina-gademan — CONFIRMED — Alpine-backed F1 Academy driver; maiden win at Zandvoort 2025; 6th in 2025 standings.
- dennis-hauger — CONFIRMED — 2025 Indy NXT champion + Rookie of the Year with Andretti (six wins); to IndyCar 2026 with Dale Coyne Racing; academy null correct.
- lochie-hughes — CONFIRMED — 3rd in 2025 Indy NXT with Andretti Global; academy null correct.
- caio-collet — CONFIRMED — 2025 Indy NXT runner-up (HMD Motorsports); academy null correct.
- connor-zilisch — CONFIRMED — 10 wins + Rookie of the Year in 2025 Xfinity, championship runner-up; to Cup 2026 with Trackhouse; academy null correct.
- corey-heim — CONFIRMED (headline + academy) — 2025 Truck champion; Toyota/TRD development driver. (See secondary error re: win count.)
- william-sawalich — CONFIRMED — two-time ARCA Menards East champion (2023, 2024); Toyota/TRD, full-time Xfinity rookie 2025 with Joe Gibbs Racing.
- mille-johansson — CONFIRMED — 2025 Junior WRC champion, clinched on the final round; earns M-Sport Ford Rally2 prize drive; academy null correct.
- noah-stromsted — CONFIRMED (headline) — 6th in 2025 FIA F3. (See academy-omission advisory.)
