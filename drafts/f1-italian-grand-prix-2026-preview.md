<!--
DRAFT — Italian Grand Prix 2026 preview. Per the Blog SOP: NOT public MDX.
Queue as a PROD DB draft via the .md -> draft-post.mts insert; the operator approves +
schedules in /blog. Do NOT publish from here.
NO publishAt key below ON PURPOSE: parseDraftMarkdown reads the first token after any
"publishAt:"/"publish_at:" line, so leaving the key out is what yields the null the SOP wants.

slug:      f1-italian-grand-prix-2026-preview
title:     Monza takes the wings off the cars, and the championship leader starts at the back
summary:   Ten teams declared 26 new parts for the Italian Grand Prix and eleven exist only to shed drag: winglets removed, a mirror stay shortened, a brake duct cascade deleted. Mercedes have also confirmed a full new power unit for Kimi Antonelli, at his home race, on the fastest circuit of the year.
series:    f1

GROUNDING (session 40, drafted Friday 4 September 2026, during FP1 week).
  Hard numbers taken VERBATIM from Paddock's own reconciled loaders via
  scripts/weekend-post-context.mts --mode preview --series f1:
    Antonelli 242, Russell 183, Hamilton 183, Norris 159, Leclerc 155.
  Constructors read off /series/f1/standings and self-checked against the driver
  totals: Mercedes 425 (242+183), Ferrari 338 (183+155), McLaren 263 (159+104).
  Red Bull's row did NOT self-check on the scrape, so no Red Bull points figure
  appears in this post.
  Upgrade counts computed from content/series/f1/upgrades.json round 13, which was
  curated this morning from FIA Document 10: 10 teams, 26 parts, 11 of them
  declared as Drag Range or Drag Reduction, across 6 teams.
  Weather from Open-Meteo by VENUE-LOCAL date (Europe/Rome), not UTC.
  Narrative cross-checked twice against formula1.com. Every internal link was
  curl-checked on prod before writing: /drivers/andrea-kimi-antonelli is a 404,
  the live slug is /drivers/kimi-antonelli, and /teams/red-bull is a 404 against
  /teams/red-bull-racing.
  NO cover image: no licence-verified Monza image was in hand at drafting time.
  Find one at review (§4 of the blog-authoring skill) or ship without.
-->

# Monza takes the wings off the cars, and the championship leader starts at the back

Most circuits ask a team to add something to the car. Monza asks them to take things off, and this year the paperwork says so in plain language.

Ten teams declared **26 new parts** to the FIA for [the Italian Grand Prix](/series/f1/weekend/13). Eleven of those parts, from six different teams, are filed under drag range or drag reduction. Read the descriptions and the weekend explains itself: [Mercedes](/teams/mercedes) have removed various winglet devices from the rear wing and trimmed the mirror rear stays. [Ferrari](/teams/ferrari) filed four parts and every one is circuit specific, including a shorter mirror stay and the deletion of a rear brake duct winglet cascade. [Alpine](/teams/alpine) have taken a fairing off the rear wing. [McLaren](/teams/mclaren) run an alternative flap position with a less loaded beam wing. [Williams](/teams/williams) put a vertical fence around the halo and cut chord out of the front wing.

Nobody is bolting anything on. They are deleting surfaces.

## Straight mode is the 2026 word for it

Three of those submissions use the same phrase, and it is worth knowing what it means. DRS no longer exists. In its place the cars run active front and rear wings with a low drag setting, so a straight line configuration is now something the car adopts rather than something a driver earns by closing to within a second. Racing Bulls' new rear wing assembly exists to let the flap travel further in that mode. McLaren's alternative flap position is the same idea from the other direction.

At the fastest circuit on the calendar, that setting is most of the lap. If you want the mechanics of what replaced DRS, we wrote them up in [what replaced DRS in F1](/information/formula-1/what-replaced-drs-manual-override-mode), and the shape of the weekend itself is in [how a Formula 1 race weekend works](/information/formula-1/how-a-formula-1-race-weekend-works).

Two teams ignored the theme entirely. [Red Bull Racing](/teams/red-bull-racing) brought reliability parts, a revised gaitor on the rear suspension to wheel bodywork joint and a trimmed exhaust tailpipe bracket, both submitted specifically to survive what Monza does to a power unit. [Haas](/teams/haas) turned up with a full development package, a new front floor with new side geometry, a new sidepod and coke line, a narrower roll hoop and an updated engine cover, which is an unusual weekend to introduce one. [Audi](/teams/audi) declared nothing at all.

## A full engine, at home, on the wrong weekend for it

[Kimi Antonelli](/drivers/kimi-antonelli) arrives at Monza leading the championship on **242 points**, 59 clear of both [George Russell](/drivers/george-russell) and [Lewis Hamilton](/drivers/lewis-hamilton) on 183. He has six wins this season. Russell has two.

He will start Sunday near the back of the grid.

Mercedes have confirmed a full new power unit for him, taken deliberately at the one race he would most like to start from the front. Toto Wolff explained the arithmetic at Zandvoort with no attempt to dress it up: "With Kimi, we're taking the full thing. Our calculations say that that's the best track to take it. Obviously, algorithms don't take their nationality into consideration. We're here to fight for a championship and not get the most PR."

The reasoning is that reliability means each Mercedes will need a penalty somewhere before the season ends, and the cheapest place to spend one is a circuit where a fast car can pass. Antonelli has taken it about as well as anyone could. Starting at the back, he said, "in some ways helps to release pressure, although I'd very much rather fight for pole and start there at the front." He reckons a top five is realistic.

So the crowd that would have adopted him gets to watch him drive through the field instead, which at Monza is not the worst way to spend an afternoon.

## Ferrari have brought an engine and an anniversary

[Ferrari](/series/f1/standings) sit second on 338 points and arrive with more than a low drag rear end. They have taken another power unit step here, following the one introduced in Austria, under the in-season upgrade allowance the 2026 rules provide. [Charles Leclerc](/drivers/charles-leclerc), who has won this race twice, in 2019 and again in 2024, is expecting what he called a very special weekend.

The team have also arranged the calendar's neatest coincidence. 2026 is thirty years since Michael Schumacher joined Ferrari and twenty since his last Monza win for them, taken on the weekend he announced his first retirement. Hamilton and Leclerc will race in suits carrying his logo and the seven stars from his helmet.

Hamilton has his own claim on the place. He and Schumacher share the record for Italian Grand Prix wins with five each, and Hamilton has taken more poles at Monza than anyone, with seven. Ferrari have won here twenty times as a team, more than anybody, which is roughly the entire emotional content of a tifosi weekend compressed into one number.

## The champion is fourth

[Lando Norris](/drivers/lando-norris) is the reigning world champion and he is fourth on 159 points, with [McLaren](/teams/mclaren) third on 263. He is also the man in form, with back to back wins at the Hungaroring and Zandvoort, the first time he has managed consecutive victories this year, and he holds the Monza lap record at 1:20.901 from 2025.

Eighty-three points is a lot to find in the races that remain. It is not nothing to find at a circuit where he already goes quicker than anybody has.

## Hot, still and completely dry

The forecast has no drama in it at all. Monza reaches 32°C on Friday, 34°C on Saturday and 31°C on Sunday, with a zero percent chance of rain on all three days and wind that never gets above 12 km/h. Nothing is going to be handed to anybody by the weather.

Pirelli have brought the C3, C4 and C5, the three softest compounds available this year, which at a circuit with two chicanes and very little else is a strategy question rather than a survival one. Fifty-three laps of 5.793 km.

## Who wins it

Russell. Not because he has been the quicker Mercedes, because he has not, but because the fastest car on the grid is about to hand one of its two drivers a clear run at pole while the other one starts from the back. He has one obvious job this weekend and no team mate in front of him to complicate it.

The interesting race is behind that. Ferrari have brought an engine step and a set of parts built for exactly this lap, in front of the only crowd that would forgive them anything. Norris has the form and the lap record. And somewhere in the middle of it, the championship leader will be coming forward through the field on the day his home crowd would rather have been watching him lead.

Session times, the full entry, and every declared part are on [the weekend page](/series/f1/weekend/13). The [standings](/series/f1/standings) update as the results land.
