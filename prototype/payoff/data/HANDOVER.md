# Nifty 1-min Data Handover

Pulled via Zerodha Kite MCP on 2026-10-14 (data ends mid-session, ~12:59 IST).

## Files
| File | Instrument | Token | Rows |
|---|---|---|---|
| `nifty50_1min.csv` | NSE:NIFTY 50 (index) | 256265 | 3,974 |
| `nifty_26O1922500CE_1min.csv` | NFO:NIFTY26O1922500CE | 12066050 | 4,071 |
| `nifty_26O1922500PE_1min.csv` | NFO:NIFTY26O1922500PE | 12066818 | 4,075 |

## Scope
- Window requested: 2026-09-29 09:15 → 2026-10-14 15:30 (last 15 calendar days).
- 11 trading days: Sep 29, 30; Oct 1, 5, 6, 7, 8, 9, 12, 13, 14 (Oct 14 partial, up to ~13:00).
- **Expiry assumption:** "22500" has several expiries. I used the nearest weekly, **19-Oct-2026** (lot size 65). Other 22500 expiries exist (03-Nov, 17-Nov, 23-Nov, Dec…) — say which if you want a different one.
- Interval: 1 minute. Columns: `datetime` (IST), `open, high, low, close, volume, oi`.

## Quick stats
| | Low | High | First open | Last close |
|---|---|---|---|---|
| Nifty 50 | 22179.90 | 22809.35 | 22732.45 | 22665.40 |
| 22500 CE | 100.95 | 526.10 | 483.85 | 239.20 |
| 22500 PE | 47.20 | 407.40 | 161.60 | 84.90 |

Last OI: CE 3,168,100 · PE 9,807,135.

## Caveats
- **Index volume/OI are 0** — normal for an index; only options carry volume/OI.
- CE series starts 09:19 on Sep 29 (no trades/candles 09:15–09:18). Options have flat, zero-volume candles in illiquid minutes (price carried forward).
- `oi` is per-minute snapshot; `volume` is per-minute traded quantity (contracts × lot size as Kite reports it).
- The contract expires 19-Oct, so it has no data beyond that and isn't a continuous series (no rollover applied).
- Raw API responses are not stored in this folder; CSVs are the full conversion.
