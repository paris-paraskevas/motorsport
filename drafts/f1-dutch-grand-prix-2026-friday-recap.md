<!--
DRAFT — Dutch Grand Prix 2026 FRIDAY recap (sole practice + Sprint Qualifying).
Per the Blog SOP: NOT public MDX. Queue as a PROD DB draft (publish_at null);
the operator approves + schedules in /blog. Do NOT publish from here.
NO publishAt key below ON PURPOSE: parseDraftMarkdown reads the first token after
any "publishAt:"/"publish_at:" line, so omitting the key is what yields null.

slug:      f1-dutch-grand-prix-2026-friday-recap
title:     One hour to learn a farewell: Antonelli leads Friday practice, Russell takes sprint pole by four hundredths
summary:   Zandvoort's last Formula 1 weekend gave the field a single hour of running before it started counting. Kimi Antonelli used it best, Max Verstappen was eleventh at his own goodbye, and George Russell found the lap that mattered when it was the only one left to find.
series:    f1
heroImage: https://upload.wikimedia.org/wikipedia/commons/thumb/1/1f/Mercedes-AMG_F1_W17_E_Performance_of_Andrea_Kimi_Antonelli_%28028A8057%29.jpg/1280px-Mercedes-AMG_F1_W17_E_Performance_of_Andrea_Kimi_Antonelli_%28028A8057%29.jpg

grounding (RULE #1 — every hard number from formula1.com's own tables, cross-checked against the session reports):
  - FP1 classification + gaps + lap counts: formula1.com results table, 2026 Netherlands, practice/1.
  - Sprint Qualifying SQ1/SQ2/SQ3 times and knockout order: formula1.com results table, sprint-qualifying.
  - Session narrative, incidents, tyre compounds, radio quote: formula1.com FP1 and SQ official reports.
  - Russell's sprint-pole count (3rd of 2026, from 5 sprint weekends: China, Canada, Zandvoort):
    cross-checked against the Chinese and Canadian SQ reports on formula1.com. One secondary source
    said "second" — that is wrong and is not used.

FLAGS for the reviewer:
  1. Yuki Tsunoda is deliberately NOT linked: /drivers/yuki-tsunoda returns 404 on prod.
  2. The nature of Isack Hadjar's injury is not stated anywhere I could verify, so the post says only
     that he is out and Lawson replaced him.
  3. Whether Antonelli's SQ1 floor damage was repaired before the sprint is unverified, so the post
     does not claim either way.
-->

# One hour to learn a farewell: Antonelli leads Friday practice, Russell takes sprint pole by four hundredths

Formula 1 came back from its summer break with one hour to work out a circuit it will never visit again. Zandvoort's last weekend is also its first sprint weekend, and a sprint weekend means a single practice session before the timing screens start deciding things. Whatever the teams left that hour with is close to what they raced all weekend.

[Kimi Antonelli](/drivers/kimi-antonelli) used it best. A 1:12.949 made him the only driver under 1m13s, and it arrived in the dying moments of the session, on his second flying lap on softs, after traffic ruined the first. He had already spun at the exit of Turn 10 by then. His verdict on the radio was honest enough: "I don't know what happened there."

## The order after the only hour of running

| Pos | Driver | Team | Gap | Laps |
|---|---|---|---|---|
| 1 | Kimi Antonelli | [Mercedes](/teams/mercedes) | 1:12.949 | 36 |
| 2 | Lando Norris | [McLaren](/teams/mclaren) | +0.121 | 30 |
| 3 | George Russell | Mercedes | +0.125 | 37 |
| 4 | Lewis Hamilton | [Ferrari](/teams/ferrari) | +0.190 | 34 |
| 5 | Charles Leclerc | Ferrari | +0.289 | 39 |
| 6 | Oscar Piastri | McLaren | +0.659 | 35 |
| 7 | Nico Hulkenberg | [Audi](/teams/audi) | +0.835 | 34 |
| 8 | Pierre Gasly | [Alpine](/teams/alpine) | +0.962 | 28 |
| 9 | Gabriel Bortoleto | Audi | +1.043 | 29 |
| 10 | Arvid Lindblad | [Racing Bulls](/teams/racing-bulls) | +1.336 | 37 |
| 11 | Max Verstappen | [Red Bull](/teams/red-bull-racing) | +1.376 | 25 |

Note the four thousandths of a second between second and third. [Lando Norris](/drivers/lando-norris) split the two Mercedes by +0.121 to [George Russell](/drivers/george-russell)'s +0.125, which is the sort of margin that means nothing on a Friday and everything by Saturday evening.

The session opened with the track declared wet, damp patches scattered around the lap and the early runners on intermediates. It dried quickly, [Oscar Piastri](/drivers/oscar-piastri) was on mediums five minutes in, and rain was threatening again by the end. [Carlos Sainz](/drivers/carlos-sainz) had the worst of it: wide into the gravel at Turn 13, wide again at Turn 11, floor damage, and last place at +3.396.

## Audi's quiet trick

Look at seventh and ninth again. [Nico Hulkenberg](/drivers/nico-hulkenberg) and [Gabriel Bortoleto](/drivers/gabriel-bortoleto) set their times on the **medium** compound while the cars around them were on softs. On a weekend with one practice session, that is a team that knew what it wanted before it arrived.

## The number that will follow Verstappen all weekend

Eleventh. [Max Verstappen](/drivers/max-verstappen) has won three times at Zandvoort since the race returned in 2021, this is the last Dutch Grand Prix the circuit will host, and he ended the only practice session 1.376s off the pace after running wide at Turn 13.

Red Bull arrived reshuffled too. [Liam Lawson](/drivers/liam-lawson) was drafted in alongside him with [Isack Hadjar](/drivers/isack-hadjar) injured, which costs the team a driver currently eighth in the [championship](/series/f1/standings) on 68 points. Lawson was fourteenth on Friday. Yuki Tsunoda, back in the field with Racing Bulls, was seventeenth.

## Sprint Qualifying: the lap Russell had not shown all day

Russell had topped neither SQ1 nor SQ2. [Charles Leclerc](/drivers/charles-leclerc) headed the first, Piastri the second. Then, with four minutes left, Norris went out into clean air and took provisional pole, and Russell answered with a 1:11.567 that beat it by **0.041s**.

| Pos | Driver | Team | SQ3 |
|---|---|---|---|
| 1 | George Russell | Mercedes | 1:11.567 |
| 2 | Lando Norris | McLaren | 1:11.608 |
| 3 | Charles Leclerc | Ferrari | 1:11.622 |
| 4 | Oscar Piastri | McLaren | 1:11.666 |
| 5 | Kimi Antonelli | Mercedes | 1:11.794 |
| 6 | Max Verstappen | Red Bull | 1:12.094 |
| 7 | Lewis Hamilton | Ferrari | 1:12.191 |
| 8 | Pierre Gasly | Alpine | 1:12.578 |
| 9 | Gabriel Bortoleto | Audi | 1:12.583 |
| 10 | Arvid Lindblad | Racing Bulls | 1:12.737 |

The top four covered 0.099s. That is the whole story of the session, and arguably of the weekend.

It is Russell's third sprint pole of 2026 from five sprint weekends, after China and Canada. He would convert this one too, but that is [Saturday's story](/series/f1/weekend/12/sprint).

Antonelli's day fell apart earlier than the timing sheet suggests. He slid off into the gravel at the penultimate corner during SQ1, carried floor damage out of it, and could only manage fifth on his final run. The championship leader, compromised before the weekend had properly started.

Behind the top ten, Lawson missed SQ3 by four tenths in eleventh. [Aston Martin](/teams/aston-martin) had a scrappy hour with new Honda hardware: [Fernando Alonso](/drivers/fernando-alonso) locked up at Turn 1, ran wide, and ended the session twenty-second and last.

## What Friday actually settled

Two things. Mercedes had the quickest car over one lap and the quickest driver over one hour, and they were not the same person. And Zandvoort's farewell had already produced a sprint grid decided by four hundredths of a second, which is a better send-off than the circuit's reputation for processional racing deserves.

Full session detail sits on the [Friday practice](/series/f1/weekend/12/practice-1) and [sprint qualifying](/series/f1/weekend/12/sprint-qualifying) pages, and the [weekend hub](/series/f1/weekend/12) carries the rest.

Photo: Yu Chu Chin, CC BY-SA 4.0, via [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Mercedes-AMG_F1_W17_E_Performance_of_Andrea_Kimi_Antonelli_(028A8057).jpg)
