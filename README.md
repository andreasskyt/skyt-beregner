# SKYT SYSTEMS: beregner (landing page)

Lead magnet for Danish companies that live on quotes and orders: "Hvor meget omsætning siger I nej til, fordi I ikke har tid til at regne på den?" Five one-tap questions, a contact form with the result blurred, then the result plus a Cal.com booking.

Static HTML, CSS and vanilla JS. No build step.

## Run locally

```bash
python3 -m http.server 8765
```

Open http://localhost:8765/beregner/ (the booking section is at `#book`).

## Files

- `beregner/index.html`: page, styles and copy
- `beregner/beregner.js`: questions, math, blurred preview, form, result, tracking
- `booking.js`: Cal.com embed and first-touch UTM storage (shared with skytsystems.dk)
- `book/img/`, `public/favicons/`: images used by the page

## Math

Only the visitor's own answers (bucket midpoints): hours on quotes per month = quotes × hours per quote; revenue declined per year = declined jobs × typical order value × win rate × 12. The one assumption is labelled on the page: how many more quotes per month if each took half the time.

## Notes

- `WEBHOOK_URL` in `beregner/beregner.js` is empty, so submissions are only logged to the console.
- The Meta Pixel only loads on the live domain.
