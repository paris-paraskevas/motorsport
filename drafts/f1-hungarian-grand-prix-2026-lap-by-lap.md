<!--
DRAFT — lap-by-lap ledger, Hungarian GP 2026 (R11). F1-only.
NOT public MDX. Prod DB draft SOP; publish_at null. Operator inserts + schedules in /blog.

slug:    f1-hungarian-grand-prix-2026-lap-by-lap
title:   Hungarian Grand Prix 2026, lap by lap: the Hungaroring race in order
summary: The Hungarian Grand Prix as it happened, front to back: Piastri's lap-one cutback, Russell's recovery from twenty-first, the three-stopping Ferraris, the lap 38 Sainz contact, the gearbox that ended the leader's race and the virtual safety car that sealed the win.
series:  f1

Grounding: scripts/lapstory-context.mts --round 11 (OpenF1 session 11342). Authoritative tier
(classification, DNFs L13/L48/L55, stints, 44 stops, VSC L56-57, penalties) verbatim.
Overtakes = OpenF1 full-field feed, likelyPitCycle rows dropped, lap-anchored (±1). Decisive passes
cross-checked vs stewards' doc + F1.com/PlanetF1/GPFans/RaceFans (RULE #1):
  - PIA past LEC then NOR on L1 (cutback at T2) — confirmed.
  - VER past HAM L16 — confirmed (operator watched the T1 dive; position feed corroborates).
  - SAI-PIA contact L38 T3 — stewards' document (5s, wholly responsible, blind-spot mitigation).
  - Feed rows DROPPED as artifacts after failing cross-check: "NOR past ANT L46" (contradicts road
    order; no press record) and "LEC past HAM L70" (press explicit: no on-track pass — the +5s
    applied at the flag re-ordered the classification; HAM road gap 4.3s ahead).
  - Norris stint list carries a compound-less L40-56 segment with NO pit stop recorded (OpenF1
    artifact); folded into the L18-56 hard stint. His real stops: L17 + L56 (VSC).
  - LEC fastest lap 1:22.000 on L58 (GPFans/press); HAM "running second" when PIA failed +
    Ferrari VSC double-stack (PlanetF1).
FLAGS: HUL past LIN written L64 per the overtake feed (recap said ~63; feed ±1 — aligned to feed here).
-->

Two McLarens disappeared up the road, then one of them disappeared for good. [Lando Norris](/drivers/lando-norris) won a [Hungarian Grand Prix](/series/f1/weekend/11) he spent half of stuck behind his team mate, via one virtual safety car, three retirements, a lap 38 collision between the leader and a backmarker, and a pit lane speeding penalty measured in decimals. Front to back, in order:

## Lap 1

[Oscar Piastri](/drivers/oscar-piastri), third on the grid, is the mover: past [Charles Leclerc](/drivers/charles-leclerc) off the line, then the cutback out of Turn 2 on [Norris](/drivers/lando-norris) for the lead. [Max Verstappen](/drivers/max-verstappen) deals with the Ferraris for third while [Lewis Hamilton](/drivers/lewis-hamilton) and Leclerc swap twice before settling, Hamilton ahead. The disaster is further back: [George Russell](/drivers/george-russell) triggers his own anti-stall at the lights and the entire field streams past, the [Mercedes](/teams/mercedes) falling to twenty-first before the lap is done. He picks off [Valtteri Bottas](/drivers/valtteri-bottas) before the line just to start the climb.

## Laps 2-18: Russell climbs, the first stops, and a fire

Russell's recovery runs like a metronome: [Lance Stroll](/drivers/lance-stroll) and [Alexander Albon](/drivers/alexander-albon) on lap 2, [Carlos Sainz](/drivers/carlos-sainz) on 3, [Oliver Bearman](/drivers/oliver-bearman) on 4, [Fernando Alonso](/drivers/fernando-alonso) on 5, [Franco Colapinto](/drivers/franco-colapinto) on 6, [Gabriel Bortoleto](/drivers/gabriel-bortoleto) on 8, [Esteban Ocon](/drivers/esteban-ocon) on 9, [Pierre Gasly](/drivers/pierre-gasly) on 12, [Nico Hülkenberg](/drivers/nico-hulkenberg) on 17, [Arvid Lindblad](/drivers/arvid-lindblad) on 18. Ten cars repassed on track before his first stop.

Stroll blinks first in the pit lane on lap 8, off his starting softs. Bottas never gets that far: the [Cadillac](/teams/cadillac)'s left front brake catches fire and he is out after 13 laps, slowing the car against the pit wall on his way in. Up front the leaders cycle through their first stops, Hamilton the most aggressive on lap 13, Verstappen 14, Piastri and Leclerc 16, Norris 17. On lap 16, mid-cycle, Verstappen goes down the inside of Hamilton at Turn 1, the pass of the afternoon, having taken [Liam Lawson](/drivers/liam-lawson) the same lap.

## Laps 19-33: the argument

Piastri leads Norris by roughly a second and the race settles into a McLaren radio drama. Norris demands to stop first; [McLaren](/teams/mclaren) refuse; Norris promises a 10-second gap on old tyres instead. [Kimi Antonelli](/drivers/kimi-antonelli) runs a long first stint to lap 22, Russell to 27. In the midfield Alonso is doing something eccentric: 34 laps on his starting softs, which holds until it doesn't, Lawson, Lindblad, Hülkenberg and Gasly all coming past between laps 24 and 27 as the rubber gives up.

Hamilton pits again on lap 30, committing to three stops. McLaren cover him with Piastri on lap 33. Norris stays out. The race turns on that.

## Laps 34-40: the leader meets the traffic

Piastri rejoins on fresh hards and drives straight into a war for fourteenth: Sainz, Bearman, Alonso, Ocon, Stroll and Colapinto trading places every lap from 36 to 40, a lap down and racing each other like the flag was theirs. On lap 38, at Turn 3, Sainz cuts back across the McLaren after a failed move on Alonso and they touch, Piastri onto the grass. The stewards later rule Sainz wholly responsible, five seconds, softened from ten only because Piastri sat in his blind spot. Alonso, on his fresh mediums, re-passes the whole cluster on laps 37 to 39 for good measure.

The time Piastri loses in that mess is the undercut-proofing Norris never got from his own pit wall. When the second stops shake out, the champion is effectively in front.

## Laps 41-55: the long game

Verstappen stops on lap 41 and takes softs, 29 laps to the flag on the red tyre, a call nobody copies. [Isack Hadjar](/drivers/isack-hadjar) covers him a lap later. [Sergio Pérez](/drivers/sergio-perez), who started from the pit lane after overnight changes, loses the suspension and parks on lap 48, Cadillac's second retirement. Antonelli makes his second stop on lap 53, Russell on 54, both onto hards. Norris still has not stopped a second time. He is 22 laps into rubber the pit wall keeps asking about, telling them the gap will come. It has: the lead is real now.

## Lap 56: the gearbox and the gift

Piastri's gearbox lets go and the McLaren rolls to a stop at Turn 3 from second place. Virtual safety car. Norris, Hamilton and Leclerc pit at reduced-delta speed, the [Ferrari](/teams/ferrari)s double-stacked; Verstappen and Antonelli stay out. The order out the other side: Norris leading on fresh softs, Verstappen second, Antonelli third after Hamilton loses the pit-exit race to the Mercedes, Leclerc fifth behind his team mate. The VSC ends on lap 57 having lasted barely a lap and decided the podium.

## Laps 57-70: run to the flag

Norris clears off, 15.080 seconds in hand at the line despite a deleted lap on 60 for track limits. Leclerc sets the fastest lap of the race on 58, a 1:22.000, chasing a Hamilton he cannot pass. Hamilton spends the closing laps harrying Antonelli's older hards for the podium and never quite gets there, and on lap 61 the stewards note him for pit lane speeding, 0.1 km/h over. The five seconds land on lap 66 and quietly hand fourth to Leclerc, 0.7 the classified gap. No pass required.

The last points move on track: Lawson takes Lindblad on lap 63 and Hülkenberg follows through on 64, [Audi](/teams/audi)'s first points of the season sealed at the expense of the rookie who had held ninth. Bortoleto, black-and-white flagged for track limits on the final lap, stays eleventh.

## Pit log (44 stops)

Two-stoppers won it, mostly by accident: Norris ran laps 18-56 on one set of hards because the VSC made his second stop free. Hamilton and Leclerc both three-stopped (13/30/56 and 16/36/56). Verstappen's 29-lap soft stint to the flag was the boldest tyre call of the day; Antonelli's lap 53 stop, three laps before the VSC, the unluckiest. Stroll stopped earliest (lap 8); Alonso ran his opening softs to lap 34.

## Retirements

- **Lap 13** [Bottas](/drivers/valtteri-bottas) (Cadillac), front-left brake fire.
- **Lap 48** [Pérez](/drivers/sergio-perez) (Cadillac), suspension, after a pit lane start.
- **Lap 55** [Piastri](/drivers/oscar-piastri) (McLaren), gearbox, from second, having led laps 1-33.

## Where it leaves the title

[Antonelli](/drivers/kimi-antonelli) keeps the [championship lead](/series/f1/standings) into the summer break, 50 points over Hamilton; Norris's first win of the season lifts the champion to fifth. [Full classification](/series/f1/results). Next: Zandvoort, 23 August.

_Lap-by-lap movements are from OpenF1 timing; overtake coverage is not exhaustive._
