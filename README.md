# Sahi concepts

Feature concepts for Sahi, each with a PRD and a clickable prototype: **Mirror** (mobile), **Payoff** (desktop Scalper, and now the mobile Option Scalper) and the **Quick Action Wheel** (mobile Option Scalper).

## What's here

| Path | What it is |
|---|---|
| `docs/sahi-mirror-mobile-prd.md` | Full PRD v2.0, rewritten from the web desktop PRD v1.1 for the Sahi iOS and Android app |
| `docs/sahi-payoff-desktop-prd.md` | Payoff (desktop) PRD v1.7: the Payoff mode on the Scalper split view, for Sahi web and the Sahi Desktop app |
| `docs/sahi-payoff-desktop-prd.html` | The same Payoff PRD as a styled page with contents, linked IDs and an open-items filter. Open it in a browser |
| `docs/sahi-quick-action-wheel-prd.html` | Quick Action Wheel PRD v1.4: hold the timeframe button on the mobile Option Scalper to open a radial menu, with a tap alternative |
| `docs/sahi-quick-action-wheel-prd-v1.2.html` | The earlier v1.2 PRD, kept because it embeds the R1 to R5 screenshots |
| `docs/sahi-quick-action-wheel-placements-prd.html` | Quick Action Wheel placement PRD v1.1: six places to anchor the same wheel, with research, measurements, a label stress test, trading-app prior art, a recommendation and a study plan |
| `prototype/quick-wheel/index.html` | Clickable phone prototype of the Quick Action Wheel PRD, with haptics. One self-contained file, no build step |
| `prototype/quick-wheel-placements/index.html` | Placement prototype: the six placements on a rebuild of the Sahi split chart, with haptics and timed tasks. One self-contained file, no build step |
| `prototype/index.html` | Clickable phone prototype of the Mirror PRD. One self-contained file, no build step |
| `prototype/payoff/index.html` | Clickable desktop prototype of the Payoff PRD on the Scalper split view. One self-contained file, no build step |
| `prototype/payoff/src/` | Sources for the Payoff prototype; `sh prototype/payoff/src/build.sh` rebuilds `index.html` |
| `prototype/payoff/data/` | Real 1-minute Kite data the prototype runs on (CSVs and handover note); `python3 prototype/payoff/data/build_data.py` regenerates `src/data.js` |
| `docs/sahi-payoff-mobile-prd.md` | Payoff (Mobile) PRD v1.0: Payoff on the mobile Option Scalper, opened from the Quick Action Wheel's seventh slot, which was Clean View |
| `docs/sahi-payoff-mobile-ux-research.md` | UX research note v1.1 on mobile Payoff: prototype measurements, other apps, a review of the concept, Payoff position by position, and 21 suggestions with before/after mock-ups (images in `docs/img/payoff-mobile-ux/`) |
| `prototype/payoff-mobile/index.html` | Clickable phone prototype of the mobile Payoff PRD, built on the placement study's Option Scalper rebuild. Of the six placements it keeps V6 only: hold the timeframe button for a panel of quick actions. One self-contained file, no build step |
| `prototype/payoff-mobile/src/` and `build.py` | Sources for the mobile Payoff prototype; `python3 prototype/payoff-mobile/build.py` rebuilds `index.html` with the desktop engine and data from `prototype/payoff/src/` |

## Sahi Mirror: mobile concept

Mirror is a post-market trade review for the Sahi app. After the 3:30 pm close it shows a trader their own day back to them: they pick why they took a trade while the outcome is still hidden, then see plan vs action, one neutral AI observation and, if they want, a rule that gets checked after the next close. Nothing from Mirror appears during market hours.

### Run the Mirror prototype

Open `prototype/index.html` in a browser. On a desktop you get a phone frame with a demo rail; on a phone the app fills the screen and the rail sits behind the **Demo** tab on the right edge.

The demo rail lets you:
- change the phone clock (11:20 am market open, 3:42 pm building, 4:05 pm ready) to see the market-hours rules,
- switch today's sample day (flagged, plan kept, no trades),
- trigger the Mirror Ready push on a lock screen (it explains why when the rules block it),
- go offline, switch light and dark, and jump straight to any surface (S2 to S6, B1, B3, B4, M2, N2).

Everything you do is saved in your browser's local storage. **Reset prototype** clears it.

All trades, prices and P&L are generated sample data for Mon 12 Oct 2026. Flags, Worth a look picks, rule check-ins, patterns and observation text are computed from that sample data using the rules in PRD Section 10. They are not hard-coded.

### Mirror surfaces covered

S2 Mirror: Day · S3 Trade Reflection (Recall and Revealed) · S4 Mirror: Patterns · S5 Mirror Settings · S6 Pattern Trades · B1 Make This a Rule · B2 Not Useful Reasons · B3 Flag Details · B4 Pick a Day · B5 Observation Options · M2 Delete All Reflections · N2 Mirror Ready banner · N3, N5, N6 snackbars · N7 Mirror Ready push · N8 Offline banner · Reflect on Positions and Orders.

## Sahi Payoff: desktop concept

Payoff shows, on the Scalper's index chart, where an options position breaks even at every future time and what it is worth at any Nifty level and time up to expiry. It never forecasts or recommends a trade, and it has no buy button.

### Run the Payoff prototype

Open `prototype/payoff/index.html` in a desktop browser. It draws the Sahi Scalper split view at 1280 px or wider and scales down to fit smaller windows.

- **Hold ⌥ Option (Mac) or Alt (Windows)** to peek at Payoff; let go to hide it.
- **Click Payoff** on the index chart toolbar to keep it on; **Esc** turns it off.
- Payoff opens on the view you already have, so the shaded future zone starts as the space right of Now. Drag or scroll the chart, or click a date chip (Today, 19 Oct, 27 Oct), to look further ahead.
- Move the pointer into the shaded future zone, or use the arrow keys (Shift for 25 points), to read P&L at any level and time.
- Hover either chart and the other mirrors the crosshair: the same minute, whatever each timeframe, at the matching level. The other chart scrolls to keep it in view.
- Each chart has its own timeframe and scrolls and zooms on its own, so Nifty can be on 3m while the option is on 5m. The 15m chevron opens 30m and 1h; 1D, 5D and 1M show the last session, five sessions or the whole month.
- Pinch out on a trackpad (or scroll the wheel) to zoom in smoothly around the pointer; swipe sideways to pan. The Nifty chart opens at about 11 px per candle.
- Drag either chart left into history or right into empty space up to 3:30 pm tomorrow, with Payoff on or off. Past the position's expiry the chart is striped and disabled.
- Click the future zone, or press Enter, to pin a point and set a target, a stop or an exit time (Later release).
- **Buy at MKT**, **Sell at MKT**, the **Option Chain** and **Positions** in the right rail all work, so you can open and close positions and watch Payoff switch between one position and several.

The **Demo controls** panel (bottom left) switches the sample positions, the clock (replayed real times today, then simulated times and the close), pricing states (live, delayed, unavailable), Mac or Windows keys, the Later release and whether orders succeed. It also shows the analytics events as they fire.

NIFTY 50 and the NIFTY 19 Oct 22500 Call and Put run on real 1-minute data from Zerodha Kite, Tue 29 Sep to 12:59 pm on Wed 14 Oct 2026, and "Now" opens at that last real minute. Later times are simulated from the real close, and other strikes and expiries are modelled from the real index. The option chart says "Modelled prices" or "Simulated after 12:59 pm" when that applies. Payoff values come from a Black-Scholes model on trading time, with IV taken from the real prices and held, as in the PRD's research.

### Payoff surfaces covered

S1 Scalper split view (Payoff button, hold-to-peek) · N1 Payoff introduction tip · S2 Payoff mode: one position · S3 Payoff mode: several positions · N2 Pricing status banner · D1 Pinned point card · M1 Confirm order from pin · N3 Order result toast · scheduled exit markers.

## Sahi Payoff: mobile concept

Payoff on the phone: on the mobile Option Scalper, the Quick Action Wheel's seventh slot, where Clean View was, now turns Payoff on and off for both charts. The index chart gains a future zone with breakeven lines and profit shading, and a **Payoff point** the trader taps, drags or long-presses into place. A docked readout shows the P&L at that Nifty level and time. With one position, the option chart shows the premium at the point; with several, a Payoff list replaces it. It never forecasts, recommends or opens a trade.

### PRD

`docs/sahi-payoff-mobile-prd.md` is a Full PRD (v1.0) written with the house PRD format. It adapts the desktop PRD v1.7 and changes the Quick Action Wheel PRD v1.4. It covers 14 surfaces: S1, S2, S3, B1, B2, N1 to N3, and the wheel surfaces it touches (QW-M1, QW-Q1, QW-B1, QW-N1, QW-T1, QW-S2). It has 32 functional and 10 non-functional requirements, 37 business rules and 53 open items and assumptions. Section 1.4 maps each desktop mechanism to its phone version and says why:

- **No hold-to-peek.** A phone has no modifier key; holding the chart is the crosshair and holding the timeframe button opens the wheel. Slot 7 and Quick actions turn Payoff on; a close button and Android back turn it off.
- **Hover becomes a Payoff point** that stays where it is left. Tap the shaded future zone to move it, drag it, or long-press and slide. It snaps to the chart's candles and to 5 Nifty points, and gives a haptic tick when it crosses a breakeven or an expiry.
- **The readout is docked** in the top-left corner of the index chart, away from the thumb, and moves when the point would sit under it.
- **The pinned point card becomes a sheet** (B1) with level and time steppers, the screen-reader path and, in the Later release, the target, stop and exit actions.
- **The opening view scrolls** so the rest of the session is in view, keeping each chart's timeframe and candle width, because a phone chart's right margin is only about six candles wide.

Example values in the PRD come from the desktop research model (Nifty 25,000, IV 12%); the prototype runs on real Kite data near 22,665, so its numbers differ.

### UX research and suggestions

`docs/sahi-payoff-mobile-ux-research.md` (v1.1) reviews PRD v1.0 and the prototype before any design work. It is desk research and measurement; no trader has tested Payoff yet.

- **Measured in the prototype:** a breakeven line is on screen in only 11 of 33 opening views; one 5-minute candle is 4.3 px wide, so time is hard to set with a thumb; the chips and close button sit 13% down the screen.
- **Other apps:** Robinhood, Dhan, moomoo, OptionStrat and Groww set time with its own slider or row, and most show amounts as well as zones.
- **Review of the concept:** how the wheel and Payoff hold up as an interaction, how new they are, whether traders need them, and the pro-tools and games reasoning.
- **Payoff by position:** what each kind of position needs from Payoff, with an expiry-day example (an at-the-money call bought at 1:00 pm needs +20 points by 2:00 pm to break even).
- **21 suggestions (UX-01 to UX-21),** with before/after mock-ups of the first ones, a usability test plan and the PRD changes each would need. None is built.

### Run the mobile Payoff prototype

The prototype now includes five suggestions from the research note. Add `&ux=a` to a link, or untick "Improved Payoff" in the demo controls, to see PRD v1.0 as first built.

- **The point is set on the chart, with no slider:** dragging the ring sets its level and its time together. Holding it at the right edge of the index chart scrolls on to later sessions and stops at the expiry; the left edge scrolls back to Now. The option chart scrolls with it. The level moves in 1-point steps when 5 points would jump more than 6 px. The time slider strip (UX-03, UX-04) was tried and removed after a phone review: it took a row between the charts, and dragging on the chart felt smoother. The header's Payoff button closes Payoff.
- **The point opens at the trader's horizon (UX-19):** 30 minutes ahead when every position is intraday or expires today, and at the session end otherwise.
- **The most the position can lose (UX-20):** the option chart's point card and the point sheet say "Most you can lose: ₹13,572, the premium paid", or "Loss isn't capped below 22,285 at expiry" for a sold option.

- **Breakevens in view (UX-01):** when Payoff opens, the index chart's price scale widens to show the nearest breakeven, and the loss side is shaded red. It stops widening when the candles would take less than 20% of the chart's height; a breakeven further out keeps an edge label with its distance, and tapping the label brings it into view. Closing Payoff puts the scale back.
- **Plain wording (UX-02):** the point sheet says "If Nifty stays at 22,665 till 3:30 pm", the change from now ("−₹521 vs now · time decay"), "Needs Nifty above 22,677 (+12)" for a loss or before a buy, and "If IV moves: …" in place of "Range".
- **A visible way in (UX-05):** a Payoff button in the index chart's header, named while a position is held and icon-only otherwise. The quick action panel and the Quick actions sheet still work, and the first-run tip points at the button.

Two parts follow Sahi's Option Seller panel on mobile (screenshots shared on 11 Nov 2026):

- **The payoff box** on the index chart comes in three takes that lead with the expected P&L, because the crosshair already shows the level on the price axis and the time on the time axis. Pick one under "Payoff box" in the demo controls, or by link:
  - `&box=a` **P&L first** (default): "Expected P&L", the amount as a headline, "At expiry −₹1,092", then "Nifty +26 pts (+0.12%)".
  - `&box=b` **Two rows:** the point's time and the expiry as two aligned rows, then the same last line.
  - `&box=c` **At the point:** a small tag beside the ring with the amount and the expiry amount; nothing is docked in the corner.
  - `&box=0` **Before:** the seller panel's payoff-graph tooltip wording ("When price is at 22665.00 0.00%", "Expected P&L on", "Today, 3:30 pm: +₹1.50K", "Expiry date: −₹2.85K").

  Tapping the box (or the ring, for take c) still opens the point sheet, which holds the plain-wording lines and the model label.
- **The option chart's point card** names its range: "Premium ₹251.40", then "If IV moves: ₹231.17 to ₹277.33". The bar on the chart is that range, the premium if IV falls 2.5 points or rises 3; the dot is the premium with IV held.
- **Several positions** open in a panel with the seller panel's structure: "NIFTY50 positions", **Positions | Analyse** tabs, leg cards (side, expiry, LTP, type, strike, quantity, P&L at the point), and under Analyse a **Summary** (Max Loss, Max Profit, POP, premium, Greeks, breakeven) and a **Payoff graph** with the point's time and the expiry date. Dragging on the graph moves the point's level, and the button in the panel's header makes it full height. Margin is not modelled, so the Summary shows Open P&L in that place.

**Quick actions, one version.** The prototype keeps only V6 of the placement study: hold "5m" on either chart, a panel opens under the button, slide to an action and release. A tap still opens the chart menu. The wheel placements V1 to V5, their demo, the timed tasks, the label stress test, the touch-zone overlay and the left-handed option are removed here; they remain in `prototype/quick-wheel-placements/`. The panel has three layouts, switched under ⋮ → Quick actions → Panel layout, or by link:

- `&qa=pills3` **Pills × 3** (default): titled sections with action pills, three a row, like the chart menu's timeframe sections. Timeframe, Drawing, Indicator and Template hold two pills each, so the third place in a row is empty; Payoff has one. A pill that is on (an indicator, Payoff, the current timeframe) has a white border and a tick. A line at the bottom names the action under the finger ("Turn on VWAP · NIFTY50").
- `&qa=pills` **Pills × 2:** the same sections with two wider pills a row.
- `&qa=list` **List:** one row per action, as V6 was. It has no template rows.

No ring pulses where an action is picked, where the panel opens, or on the Payoff point when it is moved by a tap; the haptic tick stays. The panel always opens downwards. Under the option chart's button, where the screen ends first, it moves up only as far as it must to fit and may cover the button; it never flips to open above it. Lifting the finger on the button picks nothing. Only if the panel is taller than the screen does holding open the Quick actions sheet instead.

**Quick view** lets the trader choose what the panel holds. Payoff is always the last action.

- **Two timeframes:** a "Quick view" section below Day in the chart menu (tap 5m) has two dropdowns, Timeframe 1 and Timeframe 2. Picking the other slot's timeframe swaps the two.
- **Two drawings:** the Drawing tile opens a Drawing Tools sheet (toggles, then the drawings list, as in the Sahi app) with a flash icon on the right of each drawing.
- **Two indicators:** Add indicators has a flash icon left of the star.
- **Two templates (pills layout only):** My Templates has a flash icon left of the delete icon. Templates have their own two slots and show under the Template title; a pill applies the template to that chart.
- **Limit of two per group:** when a group is full the other flash icons are dimmed, and tapping one shows "Quick view already has 2 drawings. Remove one to add another." Removing a pick leaves a dashed "Add" pill (an "Empty … slot" row in the list) until another is added.
- **A pick moves to the top at once:** tapping a flash icon lists that drawing or indicator first, after any earlier pick. The row grows 5%, travels to the top of the list while the rows it passes slide down, then settles back to its size (about 0.6 s; no motion when the phone asks for reduced motion). The list scrolls to its start so the row is seen arriving. Removing a pick slides the row back to its usual place.
- Picks are saved on the device. The prototype draws Trend Line, Horizontal Line, Rectangle and Fibonacci Retracement, and the EMA, SMA, VWAP, Bollinger Bands and Key Levels indicators; any other pick sits in the panel and says it is not drawn here.

The button beside Payoff in the index chart's header is the Sahi app's option chain button; the chain is not part of this prototype.

Open `prototype/payoff-mobile/index.html`. On a desktop you get the 412 × 915 phone with a panel beside it; on a phone the app fills the screen and the ⋮ button opens the same controls.

- **Hold** the "5m" button on either chart, **slide** to Payoff and **release**. Hold again and release on Payoff (now "On") to turn it off, or tap the Payoff button in the index chart's header. Esc stands in for Android back.
- **Move the point:** tap the shaded zone, drag the ring, or long-press anywhere and slide into the zone. Hold the ring at the right edge to reach later days. Pan and pinch work as before (the candles follow the finger); the point keeps its level and time, and an edge pill brings it back.
- **Tap the readout** for B1: steppers move the level 5 points and the time one candle. Hold a stepper to repeat.
- **Date chips** (only with `&ux=a`) fit the view to today or to an expiry; "19 Oct" shows the holiday shift ("moved from Tue 20 Oct").
- **Tap the option chart** for the order panel; buying while Payoff is on switches pre-trade to the held position, and a second position switches to the Payoff list.
- **Demo controls:** 12 sample position sets (one position, pre-trade, no contract, weekly + monthly book, iron condor, straddles, calendar, futures + put, intraday + carry-forward), carry-forward or intraday, the clock (9:30 am, 11:15 am, 12:59 pm latest data, 3:05 pm simulated, 3:45 pm closed), live, delayed, offline or unavailable prices, the Later release (order actions, B2, N3), failing orders, and the N1 tip again.
- **Links:** `?payoff=1` opens with Payoff on; `&pos=book|condor|pretrade|empty|mixed|…`, `&product=intraday`, `&clock=15:45`, `&pricing=delayed|offline|unavailable`, `&later=1`, `&box=a|b|c|0` for the payoff box, `&qa=pills3|pills|list` for the quick action panel, `&frame=small|iphone|max`, `&text=130|200`, `&coach=0&tip=0` to skip the first-run marks.

NIFTY 50 and the NIFTY 19 Oct 22500 Call and Put run on the desktop prototype's real 1-minute Kite data, up to 12:59 pm on Wed 14 Oct 2026; later times are simulated and other contracts are modelled. Values come from the same engine as desktop (Black-Scholes on trading time, IV held).

### Mobile Payoff surfaces covered

S1 Option Scalper with Payoff as the last quick action and in the Quick actions sheet · N1 Payoff introduction tip · S2 Payoff mode: one position (pre-trade, empty, intraday, expired, too-uncertain and at-expiry readouts) · S3 Payoff mode: several positions (Payoff list, squared-off and expired legs, realised today, max profit and loss) · B1 Payoff point sheet · N2 Pricing status banner (delayed, offline, closed, unavailable with Retry) · B2 Confirm order sheet and N3 snackbar (Later release) · the order panel.

## Sahi Quick Action Wheel: mobile concept

On the mobile Option Scalper, holding a chart's timeframe button ("5m") opens a quarter-circle wheel of seven fixed actions: Timeframe A and B, Trend Line, Fibonacci Retracement, a VWAP preset, an EMA preset and Clean View. Slide onto a sector and release to apply it to that chart. A tap still opens the chart menu, and every action is also in a tap list, Quick actions.

> Since the mobile Payoff PRD (v1.0), the seventh action is **Payoff**, not Clean View. The wheel PRDs and prototypes below keep Clean View as they were written; `prototype/payoff-mobile/` has the wheel with Payoff.

### PRD

`docs/sahi-quick-action-wheel-prd.html` is v1.4: v1.3 after a feasibility review. Section 01 lists what changed and why. The main findings:

- **Layout eligibility.** Scaled from the R1 screenshot, standard phones (360 to 393 wide) can't fit the 264-unit wheel while the order panel is open, so the hold opens Quick actions instead. Large phones fit it. Section 5 has the table; open decision OD-1 proposes letting the index chart's wheel extend over the option chart.
- **Labels.** "EMA 20" at the 14-unit minimum doesn't fit its sector, so labels may use two lines.
- **Figure 1** showed v1.2's 40-unit cancel circle; it's redrawn with the real 120-unit inner area.
- Clarified the fallback hint, edge-slot misses, corrupt preferences, reset copy, B1 placement, where the Clean View chip goes, and a five-step tutorial (T1).

`docs/sahi-quick-action-wheel-prd-v1.2.html` is the earlier version, kept because it embeds the R1 to R5 screenshots.

### Run the Quick Wheel prototype

Open `prototype/quick-wheel/index.html` in a browser. On a desktop you get a phone frame (Android 360×800, iPhone 390×844 or iPhone 430×932, with status bars) and a dev panel; on a phone the app fills the screen.

- **Hold** a timeframe button for 300 ms, **slide** onto a sector, **release**. Releasing on the button, in a gap between sectors, past the ring or on a greyed sector cancels. The action pill shows exactly what will happen, for example "Set both charts to 1m" or "Exit Clean View and show EMA 20".
- **Tap** for the chart menu, which now starts with a Quick actions row. Keyboard: Enter opens the menu; Shift+F10 or Q opens Quick actions.
- **When the chart is too small** (for example after tapping the option chart to open the order panel on a standard phone), holding shows "Release here for Quick actions"; let go on the button to open the tap list.
- Timeframe changes load first and apply only when verified; linked charts change together or not at all. Clean View is a mask: turning it off restores each overlay's own visibility.
- **Haptics:** a light tap on open, a selection tick per sector (at most one per 50 ms), success only after a change is verified, and a warning on failure. Android Chrome vibrates once the page has had a tap; iPhone (iOS 18+) gets a best-effort switch tick; desktop shows pulses.
- **On a phone browser**, the address bar takes chart height, so the wheel may fall back to Quick actions where the app would not. The prototype says so and offers full screen where the browser allows it; on iPhone, add it to the Home Screen.
- The dev panel shows an inspector (gesture state, availableR, hovered sector, pending load, last cancel reason) and has controls for frames, the order panel, the divider, OD-1, 200% text, linked charts, offline, load delays and failures, preset and settings failures, accounts, Live and Practice, the favourite drawing toolbar, and an event log you can export as JSON.

Market data is seeded sample data that ticks every second. Preferences, the invitation and the tip are saved per demo account in local storage; Reset this demo clears only this prototype's keys.

### Quick Wheel surfaces covered

S1 Option Scalper (hold and tap on both timeframe buttons, chart outline, status row, Clean View chip, position, pending order, SL and TP) · M1 Quick Action Wheel · Q1 Quick actions · B1 Chart Menu with the Indicator and Drawing sheets and the favourite toolbar · S2 Quick wheel settings · B2 Choice picker · M2 Reset · N1 Invitation · T1 Tutorial · N2 Toasts and inline errors · N3 Drawing banner.

## Quick Action Wheel: placement study

Where should the wheel live? PRD v1.4 anchors it on the timeframe pill, which on the index chart is in the top 15% of the screen and out of one-handed reach. The placement study compares six anchors for the same seven actions.

### Placement PRD

`docs/sahi-quick-action-wheel-placements-prd.html` (v1.1) covers the research (pie and marking menus, thumb reach and touch accuracy, edge and system gestures, shipped hold-and-slide menus), what each part of the Sahi screen already does, the six placements, measured fit, reach and target size on five screen sizes, a scored comparison, the placements ruled out, a recommendation, a study plan, requirements and analytics.

v1.1 adds two sections:

- **Long names (section 15).** A stress test of every label in all six placements, with four label sets (Default, Own presets, Any indicator, Full names) and text at 130% and 200%, on 412×915 and 360×800 phones. In v1.0, 16 of 63 slots already spilled with the default labels, 50 of 63 with long indicator names, and the readout in the centre couldn't hold a full name. The section sets the fit rules: a label, an authored short label and a full name for every action; one or two lines, then the short label, then smaller type, never an ellipsis in a slot; one layout per group of slots; the full action read out in a pill outside the wheel; and Quick actions when a label can't fit. It also gives a label budget per placement: about six characters (45 px) in the quarter fans, nine in V4 and full names in V6.
- **Prior art (section 16).** No trading app we found uses a hold–slide–release menu on a chart. MetaTrader 5's tap-opened radial chart menu is the closest. Long-press on a chart is the crosshair almost everywhere. In Kite, FYERS, Angel One and IBKR, a hold at a price or on the price axis starts an order, which is one more reason to drop V3.

| Placement | Hold to open | Acts on |
|---|---|---|
| V1 Pill fan (baseline, PRD v1.4) | Timeframe pill; quarter fan down-left | That chart |
| V2 Axis-corner fan | Corner where the price and time axes meet; quarter fan up-left | That chart |
| V3 Price-axis arc | Anywhere on the price axis; half ring at finger height | That chart |
| V4 Split-handle dial | Handle between the charts; top half index, bottom half option | The half you slide into |
| V5 Thumb dock | Floating button at the bottom right; quarter fan up-left | The chart touched last |
| V6 Press-drag list | Timeframe pill; a list you slide down (linear control) | That chart |

The recommendation is to test V1, V4, V5 and V6 with traders and drop V3. If something ships before that study, ship V4 alongside V1.

### Run the placement prototype

Open `prototype/quick-wheel-placements/index.html`. The Sahi screens are rebuilt from four app screenshots at 412×915 (within 1 to 3 px); the candles were read from the chart screenshot.

- **Desktop:** a panel next to the phone switches placement, phone size (Android 412×915 and 360×800, iPhone 390×844 and 430×932) and options (left-handed, touch zones, touches, linked timeframes, haptics, sound). It also shows the wheel geometry for the current phone, timed-task results and the event log.
- **Phone:** the app fills the screen; the ⋮ button in the top bar opens the placement picker, options, Show me how, Timed tasks, the Quick actions list and Reset charts.
- **Links:** `?v=1` to `?v=6` open a placement; add `&frame=small|iphone|max`, `&hand=left`, `&zones=1`, `&touches=1` or `&coach=0`.
- **Label stress test:** in the ⋮ menu or the desktop panel, pick a label set (Default, Own presets, Any indicator, Full names) and a text size (100%, 130%, 200%). Turn off the fit rules to see how v1.0 behaved. By link: `&labels=presets|any|full`, `&text=130|200`, `&fit=0`. A yellow tag at the bottom left shows when a test is on, and the desktop panel lists how each slot was fitted. Only the names change; the chart still draws VWAP and EMA.
- Everything on the chart works: the timeframe menu (tap the pill), Settings (seven chart types and view toggles), Add indicators (EMA, SMA, VWAP, Bollinger Bands and Key Levels are drawn), Range, drawing tools, crosshair (long-press the candles), pan, pinch, axis scaling (drag the price axis) and split resizing (drag the handle).
- **Timed tasks** run eight tasks in random order and record time, wrong actions, cancels and fallbacks per placement, exportable as JSON.
- **On a real Android phone,** a slide that starts within a finger's width of the right edge can trigger Back. That is the conflict the PRD's PL-07 describes, so hold a little in from the edge.

