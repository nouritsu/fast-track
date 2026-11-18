# Fast Track — mockups

Drawn at 44 columns, about what a 375 px phone shows. Brackets are buttons, and the words in a
block's borders are buttons too. The running app is the reference where they differ.

## Layout

Five pages side by side — **Fast │ Calendar │ Stats │ Options │ Info** — switched by the tabs along
the bottom (the accent line under the current one slides with the page) or by swiping left and
right. Start time, Goal, Edit fast and Info's Licences open as panes that hang below the page:
each rises the size of its panel and pushes the page up and off the top, with **✕ Close** and its
own button in its bottom edge, and drops back when closed. The calendar's Month and Year panes
hang above the page instead and push it down. With one open, tapping the button of another that
opens in the same place (Start and Goal, or Month and Year) swaps them: the new pane slides in
from the side its button is on as the old one slides out the other way.

## Fast page

One panel: the goal's share sits in its top edge, the fast's status at the top inside, a
coloured progress line under the timer (each cell in the colour of the stage it falls in:
Glucose blue, Fat burning orange, Ketosis red, Autophagy mauve), and the buttons in the bottom
edge.

Waiting. **Start!** starts a fast now; **◷ Start at** starts one that began earlier.

```text
╭─ Fast ───────────────────────── Goal -- ─╮
│ Stage -/- -----------                    │
│ Start --- --:-- · Ends --- --:--         │
├──────────────────────────────────────────┤
│                                          │
│                                          │
│                                          │
│                                          │
│                  Start!                  │
│                 goal 16h                 │
│          eating window 7:43:06           │
│                                          │
│                                          │
│                                          │
│                                          │
│                                          │
╰─ ◷ Start at ───────────────────── ⧗ 16h ─╯
 Fast │ Calendar │ Stats │ Options │ Info
 ‾‾‾‾
```

Fasting. Tap the timer to switch between time left and time elapsed; past the goal it counts up
as `+0:42:10`. **✕ Cancel** asks **Discard?** first; **◷ Start** moves the start; **⧗ 16h**
changes the goal.

```text
╭─ Fast ──────────────────────── Goal 81% ─╮
│ Stage 3/4 Ketosis                        │
│ Start Tue 03:39 · Ends Tue 19:39         │
├──────────────────────────────────────────┤
│                                          │
│                                          │
│                                          │
│                                          │
│                 13:00:01                 │
│                  of 16h                  │
│      ████████████████████░░░░  82%       │
│              Goal at 19:39.              │
│                                          │
│                                          │
│                                          │
│                                          │
╰─ ✕ Cancel ─ ◷ Start ─ ⧗ 16h  ■ End fast ─╯
 Fast │ Calendar │ Stats │ Options │ Info
 ‾‾‾‾
```

Ended: Done!, the summary and the status values scramble into place over the progress line. **¶ Note** adds a note and weight; **↺ Again** returns to the gate.

```text
╭─ Fast ──────────────────────── Goal 81% ─╮
│ Stage 3/4 Ketosis                        │
│ Start Tue 03:39 · Ended 16:40            │
├──────────────────────────────────────────┤
│                                          │
│                                          │
│                                          │
│                                          │
│                  Done!                   │
│            13:00:49 · Ketosis            │
│      ████████████████████░░░░  81%       │
│                                          │
│                                          │
│                                          │
│                                          │
│                                          │
╰─ ¶ Note ─────────────────────── ↺ Again ─╯
 Fast │ Calendar │ Stats │ Options │ Info
 ‾‾‾‾
```

## Panes and pages

Start time pane: a stepper for each field; `<` `>` step it and repeat while held, or drag across
it. Its bottom edge reads **✕ Close** and **▷ Start**; while fasting, the same pane moves the
start and its button reads **✓ Save**.

```text
╭─ Start time ─────────────────────────────╮
│ Day   Tue 17 Nov                    <  > │
│ Hour  06                            <  > │
│ Min   30                            <  > │
│                                          │
│ 8:00:00 ago · ends 22:30                 │
╰─ ✕ Close ────────────────────── ▷ Start ─╯
```

Goal pane: `<` `>` step the goal from 12h to 24h by the hour, then 30, 36, 42, 48, 60 and 72h.
While fasting it says when the fast would end.

```text
╭─ Goal ───────────────────────────────────╮
│ Goal  16h                           <  > │
│ 16:8 · eat within 8h                     │
│ Ends Tue 19:39                           │
│                                          │
│ Reaches Glucose, Fat burning and         │
│ Ketosis.                                 │
╰─ ✕ Close ────────────────────────────────╯
```

Calendar page: a Calendar block and a Fasts block. `<` `>` or a swipe slides the month's grid
away for its neighbour's, the grids side by side and the swipe following the finger; the header
stays put, and once the new month has landed its words shuffle into place. Tapping the month or
the year opens a pane above the page to pick one, which jumps there without sliding. Days that
ended a fast are in the colour of the deepest stage it reached, and tapping one lists only its
fasts; the stage colours sit in the block's bottom edge. Options adds ISO week numbers (**wk**)
before each week and its hours (**h**) after it, hanging outside the seven days, which stay in
the middle either way. Fasts sums up the month, then lists its fasts: **✚ add** logs one
afterwards, ✎ edits one (note, weight, start, end, goal), and ✕ or a swipe to the left deletes
it, leaving a line with **↺ undo** until you leave the page. ✎ and ✕ are Material icons.

```text
╭─ Calendar ───────────────────────────────╮
│ <          [November] [2026]           > │
│        Mo  Tu  We  Th  Fr  Sa  Su    h   │
│                                 1 102h   │
│         2   3   4   5   6   7   8  88h   │
│         9  10  11  12  13  14  15 118h   │
│        16  17  18  19  20  21  22 104h   │
│        23  24  25  26  27  28  29  50h   │
│        30                                │
╰─ ■ glu ■ fat ■ ket ■ aut ────────────────╯
╭─ Fasts ────────────────────────── ✚ add ─╮
│ November · 21 fasts · 381h               │
│ avg 18:09 · goal met 81% · longest 23:57 │
├──────────────────────────────────────────┤
│ Wednesday 25 Nov                     ✎ ✕ │
│ Tue 18:33 → 11:03 · 16:30:05             │
│ Ketosis · 103% of 16h · 79.9 kg          │
│ ¶ Hungry around the 14th hour            │
├──────────────────────────────────────────┤
│ Deleted Tuesday 24 Nov          [↺ undo] │
├──────────────────────────────────────────┤
│ Monday 23 Nov                        ✎ ✕ │
│ Sun 20:17 → 12:45 · 16:27:44             │
│ Ketosis · 102% of 16h                    │
╰──────────────────────────────────────────╯
 Fast │ Calendar │ Stats │ Options │ Info
        ‾‾‾‾‾‾‾‾
```

Month and Year panes: the twelve months, the shown one lit, or the year with jumps either way.
**⌂ Today** returns to this month.

```text
╭─ Month ──────────────────────────────────╮
│   [Jan] [Feb] [Mar] [Apr] [May] [Jun]    │
│   [Jul] [Aug] [Sep] [Oct] [Nov] [Dec]    │
╰─ ✕ Close ────────────────────── ⌂ Today ─╯
╭─ Year ───────────────────────────────────╮
│               <   2026   >               │
│      [-5] [-3] [-1] [+1] [+3] [+5]       │
╰─ ✕ Close ────────────────────── ⌂ Today ─╯
```

Info page: the stages of a fast as a bar, each stage's cells in proportion to its hours, with
the hours under it. Tap a stage's cells, or step with `<` `>`, to read what happens in it, with
papers to read; "now" marks the stage the fast in progress is in. Below come the version and
the credits as links; **third-party notices** opens the Licences pane.

```text
╭─ Info ───────────────────────────────────╮
│ Stages of a fast                         │
│ ░░░░░░░░░░░░░░█████████████░░░░░░░░░░░░░ │
│ 0h   4h       12h          24h+          │
│                                          │
│ <        ■ Ketosis 12–24h · now        > │
│ With glycogen low, the liver turns fat   │
│ into ketones, a fuel for brain and       │
│ muscle.                                  │
│ Read more                                │
│ Flipping the metabolic switch: …         │
│ Anton et al. · Obesity, 2018             │
│ …                                        │
│ Times vary with the person, the last     │
│ meal and activity. This is not medical   │
│ advice.                                  │
├──────────────────────────────────────────┤
│ Fast Track 0.1.0 · source on GitHub      │
│ based on Fast Track by Dark Rock Studios │
│ (MIT)                                    │
│ fonts Iosevka, Noto Sans Symbols 2       │
│ (SIL OFL 1.1)                            │
│ colours Catppuccin (MIT)                 │
│ icons Material Icons (Apache 2.0),       │
│ Octicons (MIT)                           │
│ licences third-party notices             │
╰──────────────────────────────────────────╯
 Fast │ Calendar │ Stats │ Options │ Info
                                     ‾‾‾‾
```

Licences pane: the bundled THIRD_PARTY_NOTICES.md as plain text, scrolling.

```text
╭─ Licences ───────────────────────────────╮
│ # Third-party notices                    │
│ …                                        │
│ ## In the app                            │
│                                          │
│ - Svelte: MIT. Copyright (c) 2016-2025   │
│ Svelte Contributors.                     │
│ - clsx, part of Svelte's runtime: MIT.   │
│ Copyright (c) Luke Edwards.              │
│ …                                        │
╰─ ✕ Close ────────────────────────────────╯
```

Stats page: a column of panes that scrolls. The span (**30d 90d 1y all**) sits in Summary's top
edge, is remembered, and sets what Length, Goal, Stages, Rhythm and Weight cover; Summary sets it
against the same span before, and Records cover the whole history. The charts are drawn (SVG) on
the text's grid in the stage colours; the length bands and the stage bar are text cells.

```text
╭─ Summary ─────────── 30d 90d 1y all ─╮
│ 26 fasts · 448h · goal met 69%       │
│ avg 17:13 · streak 1                 │
│ prior 30d: 25 fasts · avg 16:30 · 64%│
╰──────────────────────────────────────╯
╭─ Length ───────────── median 16:51 ──╮
│ 24h ─▆─────────────────────────────  │   each fast a bar in its stages'
│ 12h ▇█▇█▇▇█▇▇█▇█▇█▇▇█▇▇█▇█▇█▇▇█▇     │   colours; a white mark at the
│     ███████████████████████████████  │   goal of those that fell short
│ 26 fasts · ━ goal missed             │
│ avg 17:13 · max 34:25 · min 11:16    │
│ <12h   █░░░░░░░░░░░░░░░░░░░░░░░   1  │
│ 16–18h ████████████████████████  13  │
╰──────────────────────────────────────╯
╭─ Goal ───────────────────── 69% met ─╮
│            Mo  ■ ■ □ ■ ■             │   days in weeks, in the deepest
│            We  ■ □ ■ ■ ■             │   stage's colour: filled when a fast
│            Fr  ■ ■ ■ ■               │   met its goal, outlined when not
│ best streak 8 days · 6.1 a week      │
│ near misses 6 · avg 108% of goal     │
╰──────────────────────────────────────╯
╭─ Stages ───────────────────── 448h ──╮
│ ████████████████████████████████████ │
│ ■ Glucose      104h reached 100%     │
│ ■ Ketosis      126h reached  96%     │
╰──────────────────────────────────────╯
╭─ Rhythm ─────────────────────────────╮
│     ░░░░░░░░░░░░░░░░░░░░░░░░░░██████ │   the last 14 days in half hours,
│  Mo ████████████░░░░░░░░░░░░░░██████ │   filled while fasting
│     00     06     12     18       24 │
│ starts ~20:24 ±0:44                  │
│ ends   ~12:45 ±2:15                  │
│ eating window 9:36 on average        │
│   ▆    ▆    ▅    ▇    █    ▅    ▆    │   average hours by weekday
│   Mo   Tu   We   Th   Fr   Sa   Su   │
╰──────────────────────────────────────╯
╭─ Weight ─────────────────── 79.9 kg ─╮
│ 80.5 ·‾‾‾\___  ·  ·                  │   weighings as dots, the trend
│ 80.0      ‾‾‾‾‾‾‾‾‾‾‾\___            │   as a line
│ -0.3 kg since 22 Oct · -0.1 kg/wk    │
│ low 79.5 · high 80.3 · 12 weighings  │
╰──────────────────────────────────────╯
╭─ Records ───────────────── all time ─╮
│ longest     35:07 14 Sep             │
│ best streak 12 days 11 Jul–22 Jul    │
│ best week   139h from 14 Sep         │
│ in all      80 days of fasting       │
│ 112 fasts since 10 Jul               │
╰──────────────────────────────────────╯
```

Options page: a pane a category, in a column that scrolls like Stats: General (theme, kg or lb),
Notifications (alerts, the status notification), Calendar, openScale (weights from the scale),
Backup (export and import, and an .ics file), Regular export (on a calendar event schedule, in
systemd OnCalendar notation, said back in plain words), and Privacy: Android's cloud backup,
off by default.

```text
╭─ Privacy ────────────────────────────╮
│ Cloud backup                   [off] │
│ Off keeps your fasts out of your     │
│ Google account's backup; moving to a │
│ new phone by direct transfer works   │
│ either way, on Android 9 and newer.  │
╰──────────────────────────────────────╯
```

Status notification (Android): an ongoing notification in the system's own colours and fonts,
with a progress bar. It updates itself with the app closed (at each change, and every 5 to 15
minutes to move the bar) and can be turned off in Options.

While fasting it says "Fasting · Ketosis", the goal and the next stage's time, and a timer that
counts down to the goal and then up past it. The bar spans 0 to the goal: a segment for each
stage (Glucose 0–4h, Fat burning 4–12h, Ketosis 12–24h, Autophagy 24h+) in the stage's colour,
the tracker (the status-bar icon) at now and a point at the goal. Past the goal it spans on to
the next whole 12 hours, so the tracker keeps moving. The segments take the stage colours (blue,
orange, red and mauve unless others are chosen) as Catppuccin Mocha in dark mode and Latte in
light; the point keeps the system's colour, and a day/night switch shows at the next refresh
(at once while the app is in memory).

During the eating window it says "Eating window", the next fast's time and a timer counting down
to it, over a one-colour bar that drains as the window runs out. Once the window has closed it
says "Not fasting" with a timer since, and no bar.

```text
Fasting · Ketosis                      3:12:45
Goal 19:39 · Autophagy Wed 03:39
━━━━━━━━━━━━━━━━━━━━━━━━●┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈◆
 Glucose  Fat burning       Ketosis
```

On Android 16 the bar is a progress-centric one (segments, a point and a tracker), and the
notification asks to be a Live Update: a chip in the status bar with the time left to the goal
or past it, or left in the eating window. Older versions get a plain progress bar of the same
length and no chip.
