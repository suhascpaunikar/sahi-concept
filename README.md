# Sahi concepts

Two feature concepts for Sahi, each with a PRD and a clickable prototype: **Mirror** (mobile) and **Payoff** (desktop Scalper).

## What's here

| Path | What it is |
|---|---|
| `docs/sahi-mirror-mobile-prd.md` | Full PRD v2.0, rewritten from the web desktop PRD v1.1 for the Sahi iOS and Android app |
| `docs/sahi-payoff-desktop-prd.md` | Payoff (desktop) PRD v1.7: the Payoff mode on the Scalper split view, for Sahi web and the Sahi Desktop app |
| `docs/sahi-payoff-desktop-prd.html` | The same Payoff PRD as a styled page with contents, linked IDs and an open-items filter. Open it in a browser |
| `prototype/index.html` | Clickable phone prototype of the Mirror PRD. One self-contained file, no build step |
| `prototype/payoff/index.html` | Clickable desktop prototype of the Payoff PRD on the Scalper split view. One self-contained file, no build step |
| `prototype/payoff/src/` | Sources for the Payoff prototype; `sh prototype/payoff/src/build.sh` rebuilds `index.html` |
| `prototype/payoff/data/` | Real 1-minute Kite data the prototype runs on (CSVs and handover note); `python3 prototype/payoff/data/build_data.py` regenerates `src/data.js` |

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
