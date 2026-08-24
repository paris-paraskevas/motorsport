<!--
DRAFT — Dutch Grand Prix 2026 RACE recap. Per the Blog SOP: NOT public MDX.
PROD DB draft, publish_at NULL; operator approves + schedules in /blog.
Do NOT publish from here. No publishAt key below.

Fourth and last of the Dutch GP set. Shape and voice copied from the three
queued session recaps: results table beside the prose (not instead of it),
~9 outbound links, 20+ internal, three-sentence paragraphs, opinion stated
plainly, a verdict section, a bold "For the books" list, an italic photo
credit, zero em or en dashes.

slug:      f1-dutch-grand-prix-2026-race-recap
title:     Norris takes the last Dutch Grand Prix, and Zandvoort loses Verstappen on lap one
summary:   Lando Norris won the final Formula 1 race Circuit Zandvoort will hold, seventy-two laps after Max Verstappen put his Red Bull into the barrier at the last corner and stopped the race. Kimi Antonelli led most of it and finished second, with Mercedes moving George Russell aside to make sure of it.
series:    f1
heroImage: https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3940_by_Stepro.jpg/1280px-2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3940_by_Stepro.jpg

grounding (RULE #1):
  - Full classification, laps, gaps, points: formula1.com race-result table, read from the
    RAW page rather than a summary. Winning time 2:04:44.859 over 72 laps.
    NOTE: an automated summariser rendered that time as "2:44:44.859". It is wrong. The raw
    formula1.com HTML reads "2:4:44.859" and Paddock's own race page reads 2:04:44.859,
    which is the figure consistent with Antonelli's 2:04:56.395 at +11.536.
  - Grid + pole time (Norris, 1:11.163): formula1.com starting-grid table.
  - Fastest lap (Leclerc, 1:14.230, lap 60): formula1.com fastest-laps table. No point is
    claimed for it; the classification shows Leclerc on 10 for fifth.
  - Penalties, verbatim from the official race note: "Colapinto and Lawson received
    10-second time penalties for failing to slow for yellow flags. Sainz received a
    10-second time penalty for causing a collision." Results are marked PROVISIONAL.
  - Crash detail (end of lap 1, damp track, white line on the inside of the banked final
    corner, barrier then back across the track, right-side suspension destroyed, out
    unaided, cleared by the medical centre): formula1.com race report + The Race +
    motorsport.com, three-way agreement.
  - Sainz/Albon contact (four laps from the end, Albon around the outside of Turn 1, Sainz
    locked up over the bump and clipped him, floor damage, Albon retired) and both Sainz
    quotes: motorsport.com, corroborated by the official penalty note.
  - Mercedes team orders (Antonelli ahead at the original start, lost track position
    pitting for softs under the late VSC, Russell told to let him back through, Russell
    then held off Hamilton and Leclerc) + Russell quote: formula1.com's Russell interview,
    corroborated by motorsport.com and PlanetF1. Wolff quotes: crash.net.
  - Championship: Paddock's own standings page, and VERIFIED BY ARITHMETIC against the
    post-sprint totals used in the sprint recap. Every one closes:
    224+18=242 (Antonelli), 168+15=183 (Russell), 171+12=183 (Hamilton),
    134+25=159 (Norris), 145+10=155 (Leclerc), 112+0=112 (Verstappen), 96+8=104 (Piastri).
    Constructors from the same page: Mercedes 425, Ferrari 338, McLaren 263, Red Bull 186.
  - Norris' Hungary win (R11) confirmed from Paddock's own /series/f1/results page, so
    "second in a row" is our own data, not a press claim.
  - Norris' 2024 Zandvoort win: the Wikimedia Commons file used as the cover is captioned
    from that race's winner ceremony.
  - Every internal link HTTP-checked against prod before use (22 driver slugs, 11 team
    slugs, 5 series routes).

FLAGS:
  1. SOURCES DISAGREE on the lap Norris retook the lead: formula1.com's report says lap 52,
     Wikipedia says lap 54. Both describe the same sequence (past Antonelli into Turn 1,
     then past Hamilton when Hamilton ran wide). The post describes the sequence and does
     NOT assert a lap number.
  2. Wikipedia says Lindblad and Colapinto took drive-through penalties for passing under
     double yellows. The official race note lists 10-second penalties for Colapinto and
     Lawson and does not mention Lindblad or a drive-through. Only the official note is used.
  3. Wikipedia gives the attendance as 305,000. Single-sourced, so it is left out.
  4. Results are PROVISIONAL on formula1.com at the time of writing. Worth a re-check
     before this is scheduled.
  5. Yuki Tsunoda is named in the table but not linked: /drivers/yuki-tsunoda 404s on prod
     (same flag as the sprint recap). Isack Hadjar's absence from the Red Bull is not
     explained anywhere we could verify, so no reason is given for Lawson being in the car.
  6. Verstappen's radio message contains an expletive in every transcript we found. It is
     paraphrased rather than quoted.
  7. CUT for want of a primary source: "Verstappen's first home-race retirement since the
     circuit returned". It appears only in an aggregated search summary.
  8. CUT as Wikipedia-only: that Antonelli held a gap of over a second at the restart to
     deny Norris overtake mode, and that Hamilton lost the lead by running wide at Turn 10.
     The sequence is described without either detail.
  9. Arithmetic corrections made during drafting, recorded so they are not reintroduced:
     Norris has taken 56 points from the last two rounds and not 43, so the sentence now
     says "won the last two Grands Prix" instead; and McLaren did NOT lose ground to
     Mercedes in this race, both scored 33.
-->

# Norris takes the last Dutch Grand Prix, and Zandvoort loses Verstappen on lap one

[Lando Norris](/drivers/lando-norris) won the final Formula 1 race Circuit Zandvoort will hold: [2:04:44.859](https://www.formula1.com/en/results/2026/races/1292/netherlands/race-result) for seventy-two laps, 11.536s clear of [Kimi Antonelli](/drivers/kimi-antonelli), from pole set at 1:11.163. It is his second win in a row after [Hungary](/series/f1/results), and it took him most of the afternoon, because for the middle two thirds of the race he was not the one leading.

The image that will outlast the result is not his. At the end of the opening lap, on a surface still damp from the morning, [Max Verstappen](/drivers/max-verstappen) caught the white line on the inside of the banked final corner, lost the rear of the [Red Bull](/teams/red-bull-racing) and hit the outside barrier hard enough to [stop the race](https://www.the-race.com/formula-1/f1-dutch-gp-red-flagged-after-monster-max-verstappen-crash/). The car came back across the track in pieces. Zandvoort returned to the calendar in 2021 largely because of him, and it leaves the calendar having watched him crash out of its last race on lap one, in front of a grandstand full of orange.

He climbed out unaided, was cleared at the medical centre, and apologised to his team on the radio before he had his gloves off. Nobody at [Red Bull](/teams/red-bull-racing) offered a mechanical explanation afterwards and neither did he. His classification reads zero laps.

| Pos | Driver | Team | Gap | Pts |
|---:|---|---|---|---:|
| 1 | Lando Norris | McLaren | 2:04:44.859 | 25 |
| 2 | Kimi Antonelli | Mercedes | +11.536 | 18 |
| 3 | George Russell | Mercedes | +15.906 | 15 |
| 4 | Lewis Hamilton | Ferrari | +16.755 | 12 |
| 5 | Charles Leclerc | Ferrari | +17.258 | 10 |
| 6 | Oscar Piastri | McLaren | +32.332 | 8 |
| 7 | Liam Lawson | Red Bull | +79.915 | 6 |
| 8 | Nico Hulkenberg | Audi | +1 lap | 4 |
| 9 | Fernando Alonso | Aston Martin | +1 lap | 2 |
| 10 | Pierre Gasly | Alpine | +1 lap | 1 |
| 11 | Yuki Tsunoda | Racing Bulls | +1 lap | |
| 12 | Arvid Lindblad | Racing Bulls | +1 lap | |
| 13 | Gabriel Bortoleto | Audi | +1 lap | |
| 14 | Franco Colapinto | Alpine | +2 laps | |
| 15 | Sergio Perez | Cadillac | +2 laps | |
| 16 | Carlos Sainz | Williams | +2 laps | |
| 17 | Alexander Albon | Williams | DNF, 66 laps | |
| NC | Valtteri Bottas | Cadillac | DNF, 61 laps | |
| NC | Esteban Ocon | Haas | DNF, 52 laps | |
| NC | Lance Stroll | Aston Martin | DNF, 45 laps | |
| NC | Oliver Bearman | Haas | DNF, 2 laps | |
| NC | Max Verstappen | Red Bull | DNF, lap 1 | |

## The restart changed the race twice

The red flag handed everybody a free strategy meeting. Norris used it to fit softs; [Mercedes](/teams/mercedes) kept mediums on both cars. Then [Oliver Bearman](/drivers/oliver-bearman)'s power unit failed on the way round to the grid, the field had to complete another lap while his [Haas](/teams/haas) was cleared, and the race finally got going again from a standing start with two cars already gone.

Antonelli won the restart outright. He had already taken second off [George Russell](/drivers/george-russell) at the original start, and this time he went past Norris and kept going. Two starts, two places gained, no drama in either, which is a cold way to lead a championship and an effective one.

He led the first stop cycle and he led the second. What he could not do was hold the tyre advantage once [McLaren](/teams/mclaren) had one. Norris came back through in the final third, taking Antonelli into Turn 1 on the brakes and inheriting the lead moments later from [Lewis Hamilton](/drivers/lewis-hamilton), who was ahead of them both on an offset strategy. From there it was a straight run to the flag.

## The order from the pit wall

Then Mercedes made the call that will get talked about longer than the win. A late virtual safety car for [Esteban Ocon](/drivers/esteban-ocon)'s stopped Haas gave them a cheap stop, and they took it with Antonelli, fitting softs and dropping him behind Russell, who stayed out on old hards. Antonelli caught him quickly, and the pit wall told Russell to let him through.

Russell did not do it immediately. He argued on the radio that swapping risked the double podium, then complied, and then had to defend third from Hamilton and [Charles Leclerc](/drivers/charles-leclerc) all the way to the line on tyres that were finished. He finished 0.849s ahead of Hamilton after all that.

Afterwards he took the team's side. "Kimi was ahead of me anyway so he deserved to finish ahead," he [told Formula 1](https://www.formula1.com/en/latest/article/you-want-to-fight-for-every-single-position-russell-offers-verdict-on-mercedes-team-orders-in-dutch-gp.3qBtPSF2Jgfyu63IKV8our), pointing out that Antonelli on new rubber would have taken the place regardless. Toto Wolff called second and third [damage limitation](https://www.crash.net/f1/news/1102960/1/tough-calls-need-be-done-toto-wolff-stands-mercedes-f1-team-orders) and Russell's closing defence "really, really exceptional", which it was.

Our view: the swap was right and the argument was fair. Three points between team-mates looks small in August. If Antonelli takes this title by fewer than three, nobody at Brackley will have to explain anything, and that is precisely why they did it.

## A race that ate its own field

Only seven cars finished on the lead lap. Six retired, and the last of them was the most avoidable: in the closing laps [Carlos Sainz](/drivers/carlos-sainz) was defending from his own team-mate [Alexander Albon](/drivers/alexander-albon), who came around the outside at Turn 1. Sainz hit the bump on the inside harder than he expected, locked up, ran on and clipped him. Albon's floor was damaged and his race was over; Sainz took a ten-second penalty and, to his credit, no argument with it, calling it ["a fair penalty"](https://www.motorsport.com/f1/news/carlos-sainz-explains-fair-penalty-for-alex-albon-contact-the-worst-possible-outcome/10848715/) and the outcome "the worst possible" for [Williams](/teams/williams).

The recovery of the day came from row nine. [Fernando Alonso](/drivers/fernando-alonso) started eighteenth, ran a one-stop that nobody around him copied, and finished ninth for [Aston Martin](/teams/aston-martin)'s only points of the weekend. [Nico Hulkenberg](/drivers/nico-hulkenberg) turned thirteenth on the grid into eighth for [Audi](/teams/audi), which is some repayment for the power unit that ended his sprint on Saturday. [Liam Lawson](/drivers/liam-lawson) took seventh in the Red Bull, ten-second penalty included, in a car he had never driven before Friday.

[Leclerc](/drivers/charles-leclerc) set the fastest lap of the race, a 1:14.230 on lap 60, and finished fifth. [Oscar Piastri](/drivers/oscar-piastri) was sixth, fifteen seconds behind the Ferraris he started ahead of, and is now 55 points behind his own team-mate.

## What it did to the championship

Antonelli leaves the Netherlands on 242. Russell and Hamilton are both on 183, separated only by Russell's two wins to Hamilton's one, and Norris is fourth on 159. The lead is 59 points with eleven rounds to go, which is not safe, but it is the sort of margin that turns a season into an exercise in not making mistakes.

The two men who did most to make the race interesting are the two furthest from winning the title. Norris has won the last two Grands Prix and is still 83 adrift. Verstappen scored nothing and sits sixth on 112, which after Zandvoort is not a championship position, it is a season.

[Mercedes](/teams/mercedes) lead the constructors' table on 425 from [Ferrari](/teams/ferrari) on 338 and McLaren on 263. Two Mercedes on the podium and a Ferrari fourth and fifth is the shape this season keeps taking, and Sunday showed why it is so hard to break: McLaren had the fastest car at the end of the race and still only matched Mercedes' haul, 33 points each, because they only had one car near the front. Matching the leaders when you are 162 behind them is not progress.

## Where it leaves us

**For the books:** the last Formula 1 race at Circuit Zandvoort, Norris' second win in a row and his second at this track after 2024, Verstappen out on lap one of his home Grand Prix, a red flag before anyone had completed a lap, two power unit failures in one weekend (Hulkenberg's in the sprint, Bearman's before the restart), six retirements, only seven cars on the lead lap, and a team order that decided three points between championship rivals in the same garage.

The full classification is on the [race page](/series/f1/weekend/12/race), Saturday's is on the [sprint page](/series/f1/weekend/12/sprint), the rest of the weekend is on the [Dutch Grand Prix hub](/series/f1/weekend/12), and the running totals are on the [standings](/series/f1/standings). [Motorsport.com has the full set of results and standings](https://www.motorsport.com/f1/news/all-the-results-and-standings-from-the-2026-f1-dutch-grand-prix/10848632/), and The Race has its [winners and losers](https://www.the-race.com/formula-1/winners-and-losers-from-f1-2026-dutch-gp/).

Zandvoort came back in 2021 and spent most of the time since being told it was too narrow for modern Formula 1. It ends with a sprint won from a four-hundredths pole, a Grand Prix decided by an overtake at Turn 1 and a call from a pit wall, and its own driver in the barrier at the last corner on the first lap. Too narrow for overtaking, and it still produced more incident in one weekend than circuits twice its width manage in a season. It deserved better than a goodbye.

*Photo: Steffen Prößdorf, [CC BY-SA 4.0](https://commons.wikimedia.org/wiki/File:2024-08-25_Motorsport,_Formel_1,_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3940_by_Stepro.jpg), via Wikimedia Commons.*
