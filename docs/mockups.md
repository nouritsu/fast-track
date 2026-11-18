# Fast Track — mockups

Drawn at 44 columns, about what a 375 px phone shows. Brackets are buttons, and the words in a
block's bottom border are buttons too. The running app is the reference where they differ.

## Layout

Five pages side by side — **Fast │ Calendar │ Stats │ Options │ Info** — switched by the tabs along
the bottom (the accent line under the current one slides with the page) or by swiping left and
right. Start time, Goal and Edit fast open as panes: each rises out of the bottom edge over
the current page, the size of its panel, with **✕ Close** and its own button in its bottom edge,
and sinks back when closed.

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

Ended: Done!, the summary and the status values scramble into place. **¶ Note** adds a note and weight; **↺ Again** returns to the gate.

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
│                81% of 16h                │
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

Start time pane, TUI stepper (‹ › hold to repeat). Its bottom edge reads **✕ Close** and **▷ Start**; while fasting, the same pane moves the start and its button reads **✓ Save**.

```text
╭─ Start time ───────────────────╮
│ Day   Tue 17 Nov       [‹] [›] │
│ Hour  06               [‹] [›] │
│ Min   30               [‹] [›] │
│                                │
│ 8:00:00 ago · ends 22:30       │
│                                │
│ [Close]                 [Start]│
╰────────────────────────────────╯
```


Goal: ‹ › steps 12h to 24h by the hour, then 30, 36, 48, 60, 72h.

```text
╭─ Goal ─────────────────────────╮
│              16h               │
│      16:8 · eat within 8h      │
│                                │
│ [‹]                         [›]│
│                                │
│ Stages reached: Glucose, Fat   │
│ burning, Ketosis               │
│                         [Close]│
╰────────────────────────────────╯
```

Calendar page (the same content fills its page): fasted days in the colour of the deepest stage they reached; tap a day to show only its fasts. **✚ Add** logs a fast afterwards, **✎** edits one (note, weight, start, end, goal), and **⌫** deletes it: the entry turns into a line with **↺ Undo** until you leave the page.

```text
╭─ Calendar ─────────────────────╮
│ [‹]      November 2026     [›] │
│    Mo Tu We Th Fr Sa Su        │
│                         1      │
│     2  3  4  5  6  7  8        │
│     9 10 11 12 13 14 15        │
│    16 17 18 19 20 21 22        │
│    23 24 25 26 27 28 29        │
│    30                          │
│ ■ Glucose    ■ Fat burning     │
│ ■ Ketosis    ■ Autophagy       │
├────────────────────────────────┤
│ Monday 16 Nov               [⌫]│
│ 20:00 → 12:30 · 16:30:00       │
│ Ketosis · 103% of 16h          │
├────────────────────────────────┤
│ Saturday 14 Nov             [⌫]│
│ 19:30 → 09:45 · 14:15:00       │
│ Ketosis ·  89% of 16h          │
│                         [Close]│
╰────────────────────────────────╯
```

Info page (the same content fills its page):

```text
╭─ Info ─────────────────────────╮
│ Stages of a fast               │
│ 1 Glucose            0–4h      │
│   Fed state: your last meal's  │
│   glucose is the fuel.         │
│ 2 Fat burning       4–12h      │
│   Insulin falls; glycogen runs │
│   down; fat is released.       │
│ 3 Ketosis          12–24h      │
│   The liver turns fat into     │
│   ketones for brain and muscle.│
│ 4 Autophagy          24h+      │
│   Cells recycle worn-out parts.│
│ Times vary by person; not      │
│ medical advice.                │
├────────────────────────────────┤
│ Fast Track 0.1.0               │
│ [⚯ Source on GitHub]           │
│ Iosevka, Noto Sans Symbols 2   │
│ (SIL OFL 1.1); Catppuccin (MIT)│
│                         [Close]│
╰────────────────────────────────╯
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
│  Mo  ■ ■ □ ■ ■                       │   days in weeks, in the deepest
│  We  ■ □ ■ ■ ■                       │   stage's colour: filled when a fast
│  Fr  ■ ■ ■ ■                         │   met its goal, outlined when not
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
│  ▆  ▆  ▅  ▇  █  ▅  ▆                 │   average hours by weekday
│  Mo Tu We Th Fr Sa Su                │
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

Options page: theme, alerts, the status notification, kg or lb,
weights from openScale, export and import, and regular exports on a calendar event schedule
(systemd OnCalendar notation, said back in plain words).

Status notification (Android): an ongoing notification in the system's own colours, either
"Fasting · Ketosis" with a running timer and the goal and next stage times, or "Eating window"
counting down to the next fast. It updates itself at each change with the app closed, and can be
turned off in Options.
