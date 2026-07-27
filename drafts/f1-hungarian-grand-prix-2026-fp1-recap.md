<!--
DRAFT — Hungarian Grand Prix 2026 FP1 recap (Friday first-practice report + FP2 projection). Per the Blog SOP: NOT public MDX.
On PROD Supabase as draft id 49e381b0-7535-40a4-9d32-74bf7be15108 (publish_at null); operator approves + schedules in /blog.

slug:      f1-hungarian-grand-prix-2026-fp1-recap
title:     Fast and fragile: Ferrari top a wild Hungary FP1 as Aston's new car breaks on debut
summary:   Charles Leclerc led first practice by half a second, a Ferrari one-three with Verstappen between them, then coasted to a stop with a suspected gearbox failure. Aston's brand-new 16-part car broke on Stroll's first run and red-flagged the session. Fast and fragile, and none of it counts until FP2.
series:    f1
(heroImage: none curated; publish_at: left NULL — operator sets it at approval in /blog)

grounding (hard numbers are Paddock's OWN authoritative data; narrative cross-checked vs primary sources — RULE #1):
  - Lap times, gaps, speed-trap km/h, tyre compounds, deleted-lap + red-flag messages: Paddock's own OpenF1
    pull for Hungary FP1, session_key 11335. session_result and per-lap fastest AGREE exactly, P1-P22.
  - Red-flag cause (Stroll rear-suspension failure, Turn 2), Leclerc's late stoppage (suspected gearbox),
    the five rookies + seats, McLaren 'Macarena' wing on Fornaroli's car, Sainz/Verstappen steward summons,
    Russell deployment fix: cross-checked 2026-07-24 across The Race ("everything we learned on day one"),
    Motorsport.com, Crash.net, RacingNews365, PlanetF1, Formula1.com (all consistent).
  - Upgrade specifics: content/series/f1/upgrades.json round 11 + those reports.
  - Championship numbers: Paddock's reconciled standings loaders (unchanged since Belgium).

FLAGS for the reviewer:
  1. RESOLVED — red flag = Stroll's B-spec Aston, suspected rear-suspension failure at Turn 2, ~36 min in, unhurt.
  2. RESOLVED — rookies named: Vesti (Antonelli/Mercedes), Fornaroli (Piastri/McLaren), Hirakawa (Bearman/Haas),
     Aron (Colapinto/Alpine), Herta (Bottas/Cadillac). None are linked (no /drivers pages for reserves).
  3. Sainz + Verstappen were SUMMONED over a traffic incident; the ruling was still pending at drafting (14:00 UTC).
     Check the stewards' outcome before publish.
  4. Leclerc's stoppage cause is "suspected gearbox" per reports; keep it hedged ("suspected") unless confirmed.
  5. FP1-only + an FP2 projection, by operator call. FP2 is 15:00-16:00 UTC; fold results in afterwards if wanted.
  6. No cover sourced. Leave unset, or add a licence-safe Hungaroring/Ferrari image at review (house rules §4).
-->

# Fast and fragile: Ferrari top a wild Hungary FP1 as Aston's new car breaks on debut

All week the story was the same one: Ferrari had run out of excuses at a track built to flatter them, and this was finally the weekend to make good on the hopium. It took them one session to start. [Charles Leclerc](/drivers/charles-leclerc) topped first practice, [Max Verstappen](/drivers/max-verstappen) wedged his [Red Bull](/teams/red-bull-racing) between the two red cars, and [Lewis Hamilton](/drivers/lewis-hamilton) made it a [Ferrari](/teams/ferrari) one-three. Then, with seven minutes left, Leclerc coasted to a halt in the pit lane. Fast and fragile, and that was only half the drama, because the session's red flag belonged to an Aston Martin that broke before it had properly turned a wheel. Enjoy the hopium. Just keep a hand on your wallet.

## The order

Leclerc went round in 1:19.075 and left the rest to squabble over the scraps, half a second clear on a lap that barely lasts eighty seconds. The Dutchman was the best of them at 0.484 back, grumbling about "horrendous" downshifts on the radio and going second anyway. [Isack Hadjar](/drivers/isack-hadjar) put the other Red Bull fourth and pipped [George Russell](/drivers/george-russell)'s [Mercedes](/teams/mercedes) by 0.069, the French prodigy once again outdriving reputations twice the size of his. The eye-catcher was seventh: Frederik Vesti, standing in for the championship leader, quicker than most of the men who race these cars for a living. [Audi](/teams/audi) bracketed him, [Gabriel Bortoleto](/drivers/gabriel-bortoleto) sixth and [Nico Hülkenberg](/drivers/nico-hulkenberg) eighth. Nice while it lasts.

## The sting in the tail

Ferrari's morning came with a scare bolted to it. Leclerc had barely banked his headline lap when he was back on the radio reporting that "something broke", coasting into the pit lane with what looked like a gearbox problem and seven minutes still to run. It did not cost him top spot, but it turned an hour of pure encouragement into one of reassurance and worry in roughly equal measure. The pace is plainly there. Whether the thing survives a Sunday is suddenly a live question, which is not a sentence Ferrari supporters enjoy reading in July.

## Read the trap, not the clock

Here is the part that should worry the rest. Down the speed trap, [Lando Norris](/drivers/lando-norris) was fastest at 327 km/h and Verstappen next at 326. The two Ferraris went through at 318 and 319, down among the very slowest on the grid with only the two Aston Martins below them. On any other weekend that is a headline and a problem. Here it is a footnote. The Hungaroring is fourteen corners and one straight worth the name, Monaco without the walls, and it could not care less how fast your car goes in a line it barely owns. It rewards a car that can roll one medium-speed corner into the next without upsetting itself, which is exactly what the Ferrari has done all season. Slowest in a straight line and quickest on the lap is not a paradox at this place. It is the job description.

## The rocketship stayed in the garage

The strangest thing about the timesheet is who is not on it. [Kimi Antonelli](/drivers/kimi-antonelli) leads the [championship](/series/f1/standings) by 45 points and did not turn a competitive lap all hour, because Friday morning was young-driver duty and Toto's rocketship spent it parked while Vesti brought it up to temperature. Five teams did the same: Vesti for Antonelli, Leonardo Fornaroli for [Oscar Piastri](/drivers/oscar-piastri) at [McLaren](/teams/mclaren), Ryo Hirakawa for [Oliver Bearman](/drivers/oliver-bearman) at [Haas](/teams/haas), Paul Aron for [Franco Colapinto](/drivers/franco-colapinto) at [Alpine](/teams/alpine), and Colton Herta for [Valtteri Bottas](/drivers/valtteri-bottas) at [Cadillac](/teams/cadillac). A quarter of the usual front of the grid, in other words, sat this one out, which is your cue to hold the whole order at arm's length and to trust nothing the midfield did.

## Newey's big bet breaks on arrival

Which brings us to the car everyone came to see. [Aston Martin](/teams/aston-martin) rolled into Budapest with the biggest single upgrade anyone has brought all year, the Newey B-spec, a near-total rework of the machine: new front wing, a longer and thinner nose, every permitted floor surface touched, a new diffuser, a new three-element rear wing, sixteen parts in all, the lot built up in a frantic overnight thrash. It lasted about half an hour. Thirty-six minutes in, the rear of [Lance Stroll](/drivers/lance-stroll)'s brand-new car let go on the exit of Turn 2, spun him through 360 degrees and brought out the session's only red flag. He climbed out unhurt, which is the good news. The bad news is the rest of it: a suspected suspension failure on the debut of the most expensive gamble of their season, six minutes of everyone's running gone, and a wary [Fernando Alonso](/drivers/fernando-alonso) sent back out under orders to keep the thing off the kerbs. He managed thirteenth, Stroll never ran again and was classified twenty-first. The trap numbers, 302 and 303 km/h and flat last, tell you they have bolted on every gram of downforce the new floor will carry. Whether it is quick is a question for a car that stays in one piece. Ask again this afternoon.

## McLaren, doing quiet homework

[Norris](/drivers/lando-norris) was eleventh, the wrong side of two seconds off Leclerc, which is not where a reigning champion wants to be at a track McLaren have won at two years running. Their car has a low-speed-corner weakness, which at a circuit built almost entirely of slow and medium corners is the worst possible flaw to pack for the trip, and the new floor they brought, the first slice of a two-part package that finishes at Zandvoort, is aimed squarely at it. They handed Fornaroli's car the job of trialling their "Macarena" rear wing, their own read on Ferrari's upside-down concept, and pronounced it to be working well, even as they confirmed they will not race it here or in Holland. Friday morning did not exactly sell the package. Then again, McLaren mumbling through a Friday and then conjuring half a second on Saturday is one of the sport's oldest routines, and Piastri's car spent the hour on rookie duty. Eleventh earns a shrug, not a headline. For now.

## Asterisks before the beach

Beyond the stand-ins, this was a scruffy hour. The stewards spent most of it binning lap times, Turn 1 and Turn 7 the repeat offenders, with Russell, [Alexander Albon](/drivers/alexander-albon) and [Carlos Sainz](/drivers/carlos-sainz) among the guilty. Sainz had the morning from hell: last of the twenty-two, a fistful of deleted laps, a lurid lock-up into Turn 1 that very nearly ended in the wall, and a summons to the stewards alongside Verstappen over an earlier traffic incident. And the long-run data, the one genuinely useful thing a Friday usually hands you, was too broken up to mean much, short runs on mixed tyres either side of the stoppage. Nobody managed a race simulation worth the name. That, and a track temperature that actually resembles Sunday's, is what the afternoon is for.

## What to watch in FP2

Second practice is the one that counts, run this afternoon in the heat, far closer to what Saturday and Sunday will ask, and with all twenty race drivers finally back in their own cars. Five things worth your eyes:

- **Ferrari's health, not their speed.** The pace looks real; the worry does not go away on its own. Watch whether Leclerc's car is fixed and whether the Ferrari can string a long run together without crying off. Do both and the hopium is earned.
- **Whether Aston actually has a car.** They gathered next to nothing this morning. Can they rebuild Stroll's, keep both cars off the kerbs, and prove the sixteen parts add pace rather than only downforce and drag. This afternoon is effectively their first practice of the weekend.
- **McLaren with the grown-ups back.** [Piastri](/drivers/oscar-piastri) returns, the new floor gets a real run, and we learn whether that two-second-looking gap is genuine or the usual Friday theatre.
- **The actual rocketship.** [Antonelli](/drivers/kimi-antonelli) climbs back in, and Russell reckons the deployment gremlin that hobbled Mercedes at Spa and Silverstone is finally solved, which should sharpen them on the straights and let them simply drive. If the leader turns up quick, the corner myth dies in a hurry.
- **A first honest pecking order.** Long runs and qualifying simulations on a representative track, at a one-stop circuit where race pace tends to decide Sunday. Watch the tyres, watch Turns 1 and 7, and watch who has something genuinely in hand.

The real timesheet starts now. Session times in your own timezone, and the order as it firms up, live on the [weekend page](/series/f1/weekend/11).
