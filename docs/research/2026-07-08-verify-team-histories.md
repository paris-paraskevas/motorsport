# Team-histories fact-check — 2026-07-08

**Summary: 10 CONFIRMED, 2 MINOR-DISCREPANCY, 0 NEEDS-FIX.** All founding years and championship counts in `content/information/team-histories.json` verified against Wikipedia / official sources. Both minor items are car/era attribution wording inside the `body`, not count errors — safe to promote after a one-line copy tweak (or as-is). Many entries rely on 2025/2026 results, all of which were checked against primary/official sources.

---

### scuderia-ferrari-f1-history
**Verdict:** CONFIRMED
Founded 1929 (Enzo Ferrari). Record 16 Constructors' + 15 Drivers' (last Constructors' 2008; Drivers' won by nine drivers). Schumacher five straight 2000–2004; Constructors' 1999–2004; Ascari first title 1952; Raikkonen 2007. Still no title since 2008 (McLaren won 2024 & 2025).
Source: https://en.wikipedia.org/wiki/Scuderia_Ferrari

### mclaren-f1-history
**Verdict:** CONFIRMED
Founded 1963 (Bruce McLaren); first race 1966. 10 Constructors' + 13 Drivers' — both totals depend on 2025 and both verified: McLaren won the 2025 Constructors' (its 10th, back-to-back with 2024, first double since 1998) and Lando Norris won the 2025 Drivers' title. Norris is McLaren's 8th different champion driver; the "eight different champion drivers"/13 total requires James Hunt (1976), who is not named in the body but is correctly counted.
Sources: https://www.mclaren.com/racing/team/lando-norris/2025-world-drivers-champion/ , https://en.wikipedia.org/wiki/McLaren

### mercedes-f1-history
**Verdict:** CONFIRMED
Works team reformed 2010 (bought Brawn GP). 8 consecutive Constructors' 2014–2021 (Guinness World Record) + 7 Drivers' 2014–2020 (six Hamilton, one Rosberg in 2016). Fangio 1954 & 1955. Hamilton left for Ferrari ahead of 2025.
Source: https://www.guinnessworldrecords.com/world-records/636368-most-consecutive-formula-one-constructors-world-championship-titles

### red-bull-racing-f1-history
**Verdict:** CONFIRMED
Entered 2005 (bought Jaguar). 6 Constructors' (2010–2013, 2022–2023) + 8 Drivers' (Vettel 2010–2013, Verstappen 2021–2024). Verstappen's four-title run ended by Norris in 2025; Red Bull finished 3rd in the Constructors' in both 2024 and 2025 (451 pts in 2025). Racing Bulls is the sister team.
Sources: https://en.wikipedia.org/wiki/Red_Bull_Racing , https://en.wikipedia.org/wiki/2025_Formula_One_World_Championship

### williams-f1-history
**Verdict:** CONFIRMED
Founded 1977 (Frank Williams + Patrick Head). 9 Constructors' (1980, 1981, 1986, 1987, 1992, 1993, 1994, 1996, 1997) + 7 Drivers' (Jones, Rosberg, Piquet, Mansell, Prost, Hill, Villeneuve). First win 1979 (Regazzoni, British GP); last titles 1997; sold to Dorilton Capital 2020; Frank Williams died 2021; James Vowles team principal.
Source: https://en.wikipedia.org/wiki/Williams_Racing

### team-lotus-f1-history
**Verdict:** CONFIRMED
Team Lotus (the racing arm) is correctly dated 1954. 7 Constructors' (1963, 1965, 1968, 1970, 1972, 1973, 1978) + 6 Drivers' (Clark ×2, Hill, Rindt, Fittipaldi, Andretti); Rindt the only posthumous champion (1970); folded end of 1994.
Note (no fix needed): the parent Lotus company (Lotus Engineering/Cars) dates to 1952, but the entry is about Team Lotus and even explains the 1954 split — so `foundingYear: 1954` is correct for the subject.
Source: https://en.wikipedia.org/wiki/Team_Lotus

### ducati-motogp-history
**Verdict:** CONFIRMED
Entered premier class 2003. 5 riders' titles (Stoner 2007; Bagnaia 2022, 2023; Martin 2024 with satellite Pramac; Marquez 2025 with the factory squad) + 7 constructors' (2007 plus six straight 2020–2025 — a record consecutive streak). Triple Crown (Riders'/Teams'/Constructors') completed in both 2022 and 2025, confirmed.
Sources: https://www.ducati.com/ww/en/news/marc-marquez-and-ducati-are-the-2025-motogp-world-champions , https://news.lenovo.com/pressroom/press-releases/ducati-corse-historic-2025-motogp-triple-crown-championships-secured/

### toyota-gazoo-racing-endurance-history
**Verdict:** CONFIRMED
6 Le Mans overall wins: five straight 2018–2022, then 2026 (94th running; #7 Conway/Kobayashi/de Vries — official ACO release calls it Toyota's "sixth victory," equalling Bentley, first since 2022). First win 2018 (Alonso/Buemi/Nakajima); 2016 last-lap heartbreak. WEC: Toyota's run of Hypercar title doubles was ended by Ferrari, who took both the 2025 WEC Manufacturers' and Drivers' titles.
Sources: https://www.24h-lemans.com/en/news/toyota-take-its-sixth-victory-at-le-mans-60812 , https://www.fiawec.com/en/news/ferrari-crowned-fia-world-endurance-champions-in-bahrain/8545

### porsche-endurance-history
**Verdict:** MINOR-DISCREPANCY
Load-bearing facts all confirmed: founded 1948; record 19 overall Le Mans wins (still 19 — 2025 was a near-miss lost by ~14s, and 2026 was won by Toyota); first outright win 1970 (917); three straight 2015–2017 (919 Hybrid); TAG-Porsche powered McLaren to F1 titles in the mid-1980s.
Claim: body says "seven consecutive victories from 1981 to 1987 with the 956 and 962."
Correct value: the seven-in-a-row streak (1981–1987) is right, but the **1981 win was the Porsche 936** (936/81, Ickx/Bell) — the 956/962 won 1982–1987. Car attribution only; the streak length and the "19 wins" record are correct.
Source: https://en.wikipedia.org/wiki/List_of_24_Hours_of_Le_Mans_winners

### hendrick-motorsports-nascar-history
**Verdict:** CONFIRMED
Founded 1984. Record 15 Cup Series titles after Kyle Larson's 2025 championship (Phoenix, 2 Nov 2025; his 2nd): Johnson 7, Gordon 4, Larson (2021, 2025), Labonte (1996), Elliott (2020) = 15, across five drivers. Johnson five straight 2006–2010; surpassed Petty Enterprises as winningest team in May 2021; now 322 Cup wins (>300 points-paying, as stated).
Sources: https://www.hendrickmotorsports.com/news/articles/145153/2025-nascar-season-numbers-kyle-larson-hendrick-motorsports-cup-series-accolades , https://en.wikipedia.org/wiki/Hendrick_Motorsports

### toyota-gazoo-racing-wrc-history
**Verdict:** MINOR-DISCREPANCY
Load-bearing facts confirmed: 9 Manufacturers' titles (1993, 1994, 1999, 2018, 2021–2025), five straight 2021–2025 (one behind Lancia's record 10); Toyota Team Europe drivers' titles for Sainz, Kankkunen and Auriol.
Claim: body says "In the modern hybrid Rally1 era Toyota... [won] five consecutive manufacturers' titles from 2021 to 2025, along with drivers' championships for Ott Tanak, Sebastien Ogier and Kalle Rovanpera."
Correct value: the **Rally1 hybrid era began in 2022, not 2021**. Of the three drivers named, only Rovanpera (2022, 2023) won a Rally1-era title; **Tanak's Toyota drivers' title was 2019** and Ogier's was 2021 — both pre-Rally1. All three are genuine Toyota champions, but the "hybrid Rally1 era" bracket is imprecise. No count/year error in the 9-title total.
Source: https://en.wikipedia.org/wiki/Toyota_World_Rally_Championship_results

### audi-sport-motorsport-history
**Verdict:** CONFIRMED
13 Le Mans overall wins 2000–2014 (R8/R10 TDI/R15/R18); first diesel win 2006 (R10 TDI), first hybrid win 2012 (R18 e-tron quattro); quattro WRC Manufacturers' titles 1982 & 1984 (plus Drivers' 1983 Mikkola, 1984 Blomqvist); numerous DTM titles; left top-flight prototypes after 2016; entered F1 in 2026 as a full works team via 100% Sauber takeover (debut at the 2026 Australian GP, Bortoleto scored the team's first points).
Sources: https://www.audi-mediacenter.com/en/press-releases/united-for-the-first-time-audis-13-le-mans-winners-2471 , https://en.wikipedia.org/wiki/Audi_in_Formula_One
