# Sahi Mirror: mobile concept

Mirror is a post-market trade review for the Sahi app. After the 3:30 pm close it shows a trader their own day back to them: they pick why they took a trade while the outcome is still hidden, then see plan vs action, one neutral AI observation and, if they want, a rule that gets checked after the next close. Nothing from Mirror appears during market hours.

## What's here

| Path | What it is |
|---|---|
| `docs/sahi-mirror-mobile-prd.md` | Full PRD v2.0, rewritten from the web desktop PRD v1.1 for the Sahi iOS and Android app |
| `docs/sahi-payoff-desktop-prd.md` | Payoff (desktop) PRD v1.0: the Payoff mode on the Scalper split view, for Sahi web and the Sahi Desktop app |
| `docs/sahi-payoff-desktop-prd.html` | The same Payoff PRD as a styled page with contents, linked IDs and an open-items filter. Open it in a browser |
| `prototype/index.html` | Clickable phone prototype of the PRD. One self-contained file, no build step |

## Run the prototype

Open `prototype/index.html` in a browser. On a desktop you get a phone frame with a demo rail; on a phone the app fills the screen and the rail sits behind the **Demo** tab on the right edge.

The demo rail lets you:
- change the phone clock (11:20 am market open, 3:42 pm building, 4:05 pm ready) to see the market-hours rules,
- switch today's sample day (flagged, plan kept, no trades),
- trigger the Mirror Ready push on a lock screen (it explains why when the rules block it),
- go offline, switch light and dark, and jump straight to any surface (S2 to S6, B1, B3, B4, M2, N2).

Everything you do is saved in your browser's local storage. **Reset prototype** clears it.

All trades, prices and P&L are generated sample data for Mon 12 Oct 2026. Flags, Worth a look picks, rule check-ins, patterns and observation text are computed from that sample data using the rules in PRD Section 10. They are not hard-coded.

## Surfaces covered

S2 Mirror: Day · S3 Trade Reflection (Recall and Revealed) · S4 Mirror: Patterns · S5 Mirror Settings · S6 Pattern Trades · B1 Make This a Rule · B2 Not Useful Reasons · B3 Flag Details · B4 Pick a Day · B5 Observation Options · M2 Delete All Reflections · N2 Mirror Ready banner · N3, N5, N6 snackbars · N7 Mirror Ready push · N8 Offline banner · Reflect on Positions and Orders.
