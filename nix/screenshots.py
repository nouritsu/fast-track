# Store screenshots of the web build at a Google Pixel 9 Pro XL's 1344×2992: a made-up
# history at a frozen time, in reduced motion and the app's own fonts, so that every
# run draws the same pixels. nix/screenshots.nix runs it, and `nix run .#screenshots`
# copies the PNGs into fastlane's folder. By hand: python screenshots.py WEB OUT

import functools
import http.server
import io
import json
import random
import sys
import threading
from datetime import UTC, datetime, time, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from PIL import Image
from playwright.sync_api import sync_playwright

# The shots in store order, saved as 1_fast.png, 2_calendar.png and so on: the tab to
# open, then buttons to press ("press <name>", the first button of that name) or a
# pane to scroll up to the top ("scroll <title>"), and the theme, which is switched in
# Options as a user would.
SHOTS = [
    ("fast", "Fast", [], "mocha"),
    ("calendar", "Calendar", [], "mocha"),
    ("stats", "Stats", ["press all"], "mocha"),
    ("trends", "Stats", ["press all", "scroll Stages"], "mocha"),
    ("info", "Info", [], "mocha"),
    ("options", "Options", [], "mocha"),
    ("latte", "Fast", [], "latte"),
]

# The phone draws 448×997⅓ CSS px at 3x. A viewport is whole CSS px, so the page is
# drawn a row taller and the PNG loses its last two rows of pixels.
WIDTH, HEIGHT, SCALE = 1344, 2992, 3
VIEWPORT = {"width": WIDTH // SCALE, "height": -(-HEIGHT // SCALE)}

ZONE = "Europe/Berlin"
TZ = ZoneInfo(ZONE)
# A Thursday morning, 13 hours into a 16-hour fast begun the evening before.
NOW = datetime(2026, 11, 26, 9, 17, 42, tzinfo=TZ)
FASTING = timedelta(hours=13, minutes=7, seconds=42)

# The history: its length in days, and the seed that picks it. Another seed gives
# another history; this one ends on a ten-day streak.
DAYS = 92
SEED = 1753
NOTES = [
    "Busy day, barely noticed",
    "Long walk after work",
    "Hungry around the 14th hour",
    "Black coffee helped",
    "Dinner out, started late",
    "Slept badly, still made it",
    "Gym in the morning",
    "Easy one",
]
HOUR = 3_600_000


def ms(at: datetime) -> int:
    return round(at.timestamp() * 1000)


def history(rng: random.Random) -> list[dict]:
    """Fasts from an evening into the next day: mostly 16 hours, some 18 or 20, now and
    then a day or more, and some evenings off. They grow steadier over the months, and
    the weight falls by about a quarter of a kilo a week."""
    fasts: list[dict] = []
    notes = list(NOTES)
    ready = 0  # when the next fast can start: a meal after the last one
    for back in range(DAYS, 1, -1):  # the last ends yesterday, before the one in progress
        day = NOW.date() - timedelta(days=back)
        habit = 1 - back / DAYS
        late = day.weekday() in (4, 5)  # Friday and Saturday evenings run late
        if rng.random() < (0.16 if late else 0.06) * (1 - habit / 2):
            continue
        evening = datetime.combine(day, time(21 if late else 19, 45), TZ)
        start = ms(evening) + round(rng.gauss(0, 30) * 60_000) + rng.randrange(60_000)
        if start < ready:
            continue
        kind = rng.random()
        if kind < 0.7 or back < 4:  # nothing long runs into the fast in progress
            goal, hours = 16, rng.gauss(16.2 + 0.6 * habit, 0.6)
        elif kind < 0.92:
            goal = rng.choice((18, 20))
            hours = rng.gauss(goal + 0.2, 0.7)
        else:
            goal = rng.choice((24, 24, 36))
            hours = rng.gauss(goal + 0.3, 0.8)
        end = start + round(hours * HOUR)
        ready = end + 4 * HOUR
        weight = round(83.4 - 3.3 * habit + rng.gauss(0, 0.25), 1) if rng.random() < 0.6 else None
        note = notes.pop(rng.randrange(len(notes))) if notes and rng.random() < 0.08 else ""
        fasts.append({"id": f"fast-{len(fasts) + 1}", "start": start, "end": end, "goal": goal, "note": note, "weight": weight})
    return fasts


def saved() -> dict:
    """What the app keeps in Capacitor Preferences (app/src/lib/fasting/store.ts)."""
    exported = (NOW - timedelta(days=4, hours=12, minutes=23)).astimezone(UTC)
    return {
        "fasts": history(random.Random(SEED)),
        "active": {"start": ms(NOW - FASTING), "goal": 16},
        "settings": {
            "goal": 16,
            "alerts": True,
            "status": True,
            "unit": "kg",
            "lastExport": exported.isoformat(timespec="milliseconds").replace("+00:00", "Z"),
            "exportOn": True,
            "exportEvery": "Sun 21:00",
            "scaleUser": None,
            "weekStart": 1,
            "weekNumbers": False,
            "weekTotals": True,
            "statsSpan": 30,
        },
    }


def seed_script(origin: str) -> str:
    """Fills storage before the app loads. In a browser, Preferences keeps each key in
    localStorage under its group's prefix (@capacitor/preferences, dist/esm/web.js)."""
    items = {f"CapacitorStorage.{key}": json.dumps(value) for key, value in saved().items()}
    return f"""
if (location.origin === {json.dumps(origin)})
  for (const [key, value] of Object.entries({json.dumps(items)}))
    if (localStorage.getItem(key) === null) localStorage.setItem(key, value)
"""


def serve(root: str) -> str:
    """Serves the build on a free port: Vite's absolute asset paths need http."""

    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *args):
            pass

    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=root))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return f"http://127.0.0.1:{server.server_port}"


def open_tab(page, name: str):
    page.get_by_role("tab", name=name, exact=True).click()
    return page.locator(f"#page-{name.lower()}")


def scroll_to(page, shown, title: str) -> None:
    """Turns the wheel over the page's column of panes until the pane called `title`
    sits where the first one does, or the column ends."""
    column = shown.locator(".panes")
    box = column.bounding_box()
    page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
    first = shown.get_by_role("heading").first.bounding_box()["y"]
    by = shown.get_by_role("heading", name=title, exact=True).bounding_box()["y"] - first
    top = column.evaluate("(el) => el.scrollTop") + by
    page.mouse.wheel(0, by)
    page.wait_for_function(
        "([el, top]) => Math.abs(el.scrollTop - Math.min(top, el.scrollHeight - el.clientHeight)) < 1",
        arg=[column.element_handle(), top],
    )


def shoot(browser, origin: str, tab: str, actions: list[str], theme: str) -> bytes:
    context = browser.new_context(
        viewport=VIEWPORT,
        device_scale_factor=SCALE,
        is_mobile=True,
        has_touch=True,
        locale="en-GB",
        timezone_id=ZONE,
    )
    errors: list[str] = []
    try:
        context.add_init_script(seed_script(origin))
        context.clock.set_fixed_time(NOW)
        page = context.new_page()
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.emulate_media(reduced_motion="reduce")
        page.goto(origin + "/")
        page.get_by_text("left of 16h").wait_for()  # the fast in progress has loaded
        if theme == "latte":
            open_tab(page, "Options").get_by_role("button", name="Flavour: Mocha").click()
        shown = open_tab(page, tab)
        for action in actions:
            verb, _, name = action.partition(" ")
            if verb == "press":
                shown.get_by_role("button", name=name, exact=True).first.click()
            elif verb == "scroll":
                scroll_to(page, shown, name)
            else:
                raise ValueError(f"unknown action: {action}")
        # Every face, drawn yet or not, so that no text shows in a fallback font.
        pending = page.evaluate(
            """async () => {
              await Promise.all([...document.fonts].map((font) => font.load()))
              await document.fonts.ready
              return [...document.fonts].filter((font) => font.status !== 'loaded').map((font) => font.family)
            }"""
        )
        if pending:
            raise RuntimeError(f"fonts not loaded: {pending}")
        png = page.screenshot(animations="disabled")
    finally:
        context.close()
    if errors:
        raise RuntimeError(f"the page failed: {errors}")
    return png


def save(png: bytes, path: Path) -> None:
    """Crops to the phone's height, in RGB: Google Play takes no alpha."""
    image = Image.open(io.BytesIO(png))
    if image.size != (WIDTH, VIEWPORT["height"] * SCALE):
        raise RuntimeError(f"{path.name}: drawn at {image.size}")
    image.convert("RGB").crop((0, 0, WIDTH, HEIGHT)).save(path, optimize=True)


def main(web: str, out: str) -> None:
    origin = serve(web)
    Path(out).mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        for n, (name, tab, actions, theme) in enumerate(SHOTS, 1):
            path = Path(out, f"{n}_{name}.png")
            save(shoot(browser, origin, tab, actions, theme), path)
            print(path.name)
        browser.close()


if __name__ == "__main__":
    main(*sys.argv[1:])
