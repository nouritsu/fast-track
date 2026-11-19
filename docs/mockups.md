# Fast Track — mockups

Drawn at 44 columns, about what a 375 px phone shows. Brackets are buttons, and the words in a
block's borders are buttons too. The running app is the reference where they differ.

The icons are Material Icons, drawn as SVG in the accent: on the buttons, and before each
block's title (a timer for Fast, a lock for Privacy, a trophy for Records). The mockups draw the
buttons' with the nearest symbol and leave the titles' out. Values that change in place (a word
button, a stepper's value on a tap, the calendar's month, Stats' numbers as the span changes)
shuffle their letters into the new text; the theme's word just changes.

Panes push other panes, never the screen: in a column of panes (Stats, Options), a block that
opens from a button unfolds right below the block it belongs to and pushes the ones under it
down, and folds back up when it closes (Options' Colours, Stats' Put away).

## Layout

Five pages side by side — **Fast │ Calendar │ Stats │ Options │ Info** — switched by the tabs along
the bottom (the accent line under the current one slides with the page) or by swiping left and
right; the pages slide only when one is turned. Options' Pages block reorders the tabs, hides
Calendar, Stats or Info, and picks the page the app opens on, which it opens straight onto.
Start time, Goal, Edit fast and Info's Licences open as panes that hang below the page:
each rises the size of its panel and pushes the page up and off the top, with **✕ Close** at the right of its
top edge and its own button in its bottom edge, and drops back when closed. The calendar's Month and Year panes
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

Fasting. The timer is in the colour of the stage the fast is in. Tap it to switch between time left and time elapsed; past the goal it counts up
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
it. **✕ Close** sits in its top edge and **▷ Start** in its bottom one; while fasting, the same pane moves the
start and its button reads **✓ Save**.

```text
╭─ Start time ─────────────────── ✕ Close ─╮
│ Day   Tue 17 Nov                    <  > │
│ Hour  06                            <  > │
│ Min   30                            <  > │
│                                          │
│ 8:00:00 ago · ends 22:30                 │
╰──────────────────────────────── ▷ Start ─╯
```

Goal pane: `<` `>` step the goal from 12h to 24h by the hour, then 30, 36, 42, 48, 60 and 72h.
While fasting it says when the fast would end.

```text
╭─ Goal ───────────────────────── ✕ Close ─╮
│ Goal  16h                           <  > │
│ 16:8 · eat within 8h                     │
│ Ends Tue 19:39                           │
│                                          │
│ Reaches Glucose, Fat burning and         │
│ Ketosis.                                 │
╰──────────────────────────────────────────╯
```

Calendar page: a Calendar block and a Fasts block. `<` `>` or a swipe slides the month's grid
away for its neighbour's, the grids side by side and the swipe following the finger; the header
stays put, and once the new month has landed its words shuffle into place. Tapping the month or
the year opens a pane above the page to pick one, which jumps there without sliding. Days that
ended a fast are in the colour of the deepest stage it reached, and tapping one lists only its
fasts; the stage colours sit in the block's bottom edge. Options adds ISO week numbers (**wk**)
before each week and its hours (**h**) after it, hanging outside the seven days, which stay in
the middle either way. Today is in the accent and underlined in it. Fasts sums up the month,
its numbers in the accent and the goal's share green when met, yellow from half and red below,
then lists its fasts, each with a bar down its left edge in its deepest stage's colour: from and
to, its length, a progress line to its goal in the stage colours with the share beside it, the
time in its deepest stage, how far past the goal or short of it, its weight and, with BMI on,
◆ and the BMI. **✚ add** logs one afterwards, ✎ edits one (note, weight, start, end, goal), and
✕ or a swipe to the left deletes it, leaving a line with **↺ undo** until you leave the page.

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
│▎Wednesday 25 Nov                     ✎ ✕ │
│▎from Tue 18:33 to 11:03 · 16:30:05       │
│▎██████████████████████████  103% of 16h  │
│▎Ketosis 4:30 · +0:30 · 79.9 kg ◆ 24.7    │
│▎¶ Hungry around the 14th hour            │
├──────────────────────────────────────────┤
│  Deleted Tuesday 24 Nov         [↺ undo] │
├──────────────────────────────────────────┤
│▎Monday 23 Nov                        ✎ ✕ │
│▎from Sun 20:17 to 12:45 · 16:27:44       │
│▎██████████████████████████  102% of 16h  │
│▎Ketosis 4:27 · +0:27                     │
╰──────────────────────────────────────────╯
 Fast │ Calendar │ Stats │ Options │ Info
        ‾‾‾‾‾‾‾‾
```

Month and Year panes: the twelve months, the shown one lit, or the year with jumps either way.
**⌂ Today** returns to this month.

```text
╭─ Month ──────────────────────── ✕ Close ─╮
│   [Jan] [Feb] [Mar] [Apr] [May] [Jun]    │
│   [Jul] [Aug] [Sep] [Oct] [Nov] [Dec]    │
╰──────────────────────────────── ⌂ Today ─╯
╭─ Year ───────────────────────── ✕ Close ─╮
│               <   2026   >               │
│      [-5] [-3] [-1] [+1] [+3] [+5]       │
╰──────────────────────────────── ⌂ Today ─╯
```

Info page: two blocks. Stages of a fast shows them as a bar, each stage's cells in proportion to
its hours, with the hours under it. Tap a stage's cells, or step with `<` `>`, to read what happens
in it, with papers to read; "now" marks the stage the fast in progress is in. It takes the height
About leaves and scrolls inside, so stepping through the stages moves nothing else. About sits at
the bottom, as tall as its lines: the version and the credits as links; **third-party notices**
opens the Licences pane.

```text
╭─ Stages of a fast ───────────────────────╮
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
╰──────────────────────────────────────────╯
╭─ About ──────────────────────────────────╮
│ Fast Track 0.1.0 · source on GitHub      │
│ based on Fast Track by Dark Rock Studios │
│ (MIT)                                    │
│ font Iosevka (SIL OFL 1.1)               │
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
╭─ Licences ───────────────────── ✕ Close ─╮
│ # Third-party notices                    │
│ …                                        │
│ ## In the app                            │
│                                          │
│ - Svelte: MIT. Copyright (c) 2016-2025   │
│ Svelte Contributors.                     │
│ - clsx, part of Svelte's runtime: MIT.   │
│ Copyright (c) Luke Edwards.              │
│ …                                        │
╰──────────────────────────────────────────╯
```

Stats page: a column of panes that scrolls. The span (**30d 90d 1y all**) sits in Summary's top
edge, is remembered, and sets what Length, Goal, Stages, Rhythm and Weight cover; Summary sets it
against the same span before, with a green ▲ or a red ▼ beside each value that rose or fell, and
Records cover the whole history. Values are in the accent. The charts are drawn (SVG) on the
text's grid in the stage colours; the length bands and the stage bar are text cells.

**⇅ Arrange** in Summary's bottom edge sets ˄ ˅ ✕ into the top edge of every pane below it: up,
down, and put away. A Put away block unfolds below Summary, pushing the panes down, with a **+**
word for each pane put away to bring it back; **✓ Done**, or leaving the page, folds it away and
ends arranging; **↺ Reset** beside Done puts every pane back in the first order.

```text
╭─ Summary ─────────── 30d 90d 1y all ─╮
│ 26 fasts ▲ · 448h ▲ · goal met 69% ▼ │
│ avg 17:13 ▲ · streak 1               │
│ prior 30d: 25 fasts · avg 16:30 · 72%│
╰─ ⇅ Arrange ──────────────────────────╯
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

Options page: a pane a category, in a column that scrolls like Stats: Theme (flavour and
colours), Display, Pages, Body (kg or lb, and BMI), Notifications (alerts, the status
notification), Calendar, openScale (weights from the scale), Backup (export and import, an .ics
file, and regular exports) and Privacy: Android's cloud backup, off by default. A setting that is
off reads muted.

Theme: Flavour steps through Mocha, Latte and System, which shows Mocha while the phone is dark
and Latte while it is light, and follows it. Colours shows the accent and the four stage colours
as squares; tapping them unfolds the Colours block right below Theme, pushing Display and the
rest down. It has a stepper for each, through Catppuccin's fourteen accents, each shown as a bar
in its colour and its name, in Latte or Mocha as the theme is. A change applies at once, to the
app and the status notification; **↺ Defaults** brings back mauve, blue, peach, red and mauve, and
**✕ Close**, the squares again, or leaving the page folds it away.

Display: Text size (System, Small, Normal, Large), Motion and Haptics (System, On, Off). System
follows the phone: its font size, Remove animations, and touch feedback.

Pages: the five pages in the tabs' order, each moved with ˄ ˅; Calendar, Stats and Info can be
turned off, Fast and Options always show. **Opens on** picks the page the app starts on.

```text
╭─ Theme ──────────────────────────────────╮
│ Flavour                        [System]  │
│ Colours                       [■■■■■]    │
╰──────────────────────────────────────────╯
╭─ Display ────────────────────────────────╮
│ Text size                      [System]  │
│ Motion                         [System]  │
│ Haptics                           [Off]  │
│ System follows the phone: its font size, │
│ Remove animations, and touch feedback.   │
╰──────────────────────────────────────────╯
╭─ Pages ──────────────────────────────────╮
│ Fast                      always   ˄  ˅  │
│ Calendar                    [on]   ˄  ˅  │
│ Stats                       [on]   ˄  ˅  │
│ Options                   always   ˄  ˅  │
│ Info                       [off]   ˄  ˅  │
│ Opens on                         [Fast]  │
│ The tabs follow this order; Fast and     │
│ Options always show.                     │
╰──────────────────────────────────────────╯
╭─ Colours ────────────────────── ✕ Close ─╮
│ Accent       ████ Mauve             <  > │
│ Glucose      ████ Blue              <  > │
│ Fat burning  ████ Peach             <  > │
│ Ketosis      ████ Red               <  > │
│ Autophagy    ████ Mauve             <  > │
╰───────────────────────────── ↺ Defaults ─╯
```

Body: the weight's unit (kg or lb), and BMI, off by default. On, it adds the height's own unit
(cm, or ft for feet and inches; older settings start it at the weight's) and a Height row,
stepped by `<` `>` like Start time's fields: by the cm, 100–250, or by the inch, as `5′ 11″`; it
is stored in cm either way. Under it the formula: the imperial one in pounds and inches, else the
metric one, the imperial measure converted. It is filled in with the latest weight the app knows,
from a fast or openScale; without a weight or a height it shows without numbers. With a height set,
Stats' Weight block adds ◆ and the BMI to its top edge (`79.9 kg ◆ 24.7`) and the change in BMI to
its change line (`-0.3 kg ◆ -0.1 since 22 Oct · -0.1 kg/wk`).

Backup: export writes a file a day, `fast-track-YYYY-MM-DD.json`, in Documents/FastTrack/, or with
**Keep one file** on a single `fast-track.json` that every export replaces; the .ics file is
unaffected. Regular exports below the rule take a calendar event schedule in systemd's OnCalendar
notation, said back in plain words with the next run; tapping an example fills the field and saves
it. Where Android 11 or newer will not let the app replace a file an earlier install left, the
export says so.

```text
╭─ Body ───────────────────────────────────╮
│ Weight unit                         [kg] │
│ BMI                                 [on] │
│ Height unit                         [cm] │
│ Height  180 cm                      <  > │
│ BMI = 80.6 kg / (1.80 m)² = 24.9         │
╰──────────────────────────────────────────╯
╭─ Backup ─────────────────────────────────╮
│ Last export Nov 18, 2026, 8:12 PM.       │
│ [⤓ export]   [⤒ import]                  │
│ [⤓ export to calendar (.ics)]            │
│ Import adds the fasts the app lacks and  │
│ changes none.                            │
├──────────────────────────────────────────┤
│ Keep one file                       [on] │
│ In Documents/FastTrack/, one file,       │
│ replaced each time: fast-track.json.     │
│ Export on a schedule                [on] │
│ Every  [Mon..Fri 08:00               ]   │
│ On weekdays at 08:00. Next Thu 08:00.    │
│ daily  weekly  Sun 21:00  Mon..Fri 08:00 │
│ *:0/30                                   │
│ Last regular export Nov 18, 2026, 8:00   │
│ AM to                                    │
│ Documents/FastTrack/fast-track.json.     │
╰──────────────────────────────────────────╯
```

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
counts down to the goal and then up past it. The bar spans 0 to the goal and reads like the
app's progress line: the time fasted in the colours of the stages it went through (Glucose 0–4h,
Fat burning 4–12h, Ketosis 12–24h, Autophagy 24h+), the rest muted and broken where each stage
still ahead begins, with a small rounded diamond in the stage's colour at now. A timer opens the
bar and a flag closes it, in the accent, which keeps the bar off the notification's edges. Past
the goal it spans on to the next whole 12 hours, broken at the goal, and the flag turns green.
Android draws its own bar points only as large squares, so it uses none. The colours are the ones chosen
in Options, as Catppuccin Mocha in dark mode and Latte in light; the icon takes the accent, and
a day/night switch shows at the next refresh (at once while the app is in memory).

During the eating window it says "Eating window", the next fast's time and a timer counting down
to it, over a bar in the accent that drains to muted as the window runs out, from a fork and
spoon to a timer. Once the window has closed it
says "Not fasting" with a timer since, and no bar.

```text
Fasting · Ketosis                      3:12:45
Goal 19:39 · Autophagy Wed 03:39
◷ ━━━━━━━━━━━━━━━━━━━━━◆┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈ ⚑
 Glucose  Fat burning       Ketosis
```

On Android 16 the bar is a progress-centric one (segments, a point and a tracker), and the
notification asks to be a Live Update: a chip in the status bar with the time left to the goal
or past it, or left in the eating window. Older versions get a plain progress bar of the same
length and no chip.
