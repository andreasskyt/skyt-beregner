# SKYT SYSTEMS: beregner landing pages

Two lead magnets, same layout (one-tap questions, a contact form with the result blurred, then the result plus a Cal.com booking):

- `/beregner/`: workshop calculator for the Tjure ads ("AI-klar før 2027"). "Hvor meget tid går tabt i jeres hverdag?" 4 questions: staff at a computer, hours a day on repetitive tasks, how often people wait on a key person, AI use today. Shows hours a month on repetitive tasks, hours a month back with our minimum promise of 2 hours a week per person, and the workdays a year that equals.
- `/tilbud-beregner/`: quote calculator for companies that live on quotes and orders. "Hvor meget omsætning siger I nej til?" Shows hours on quotes, revenue declined per year (declined jobs × order value × win rate × 12) and extra quotes if each took half the time.

Static HTML, CSS and vanilla JS. No build step.

## Run locally

```bash
python3 -m http.server 8765
```

Open http://localhost:8765/beregner/ or http://localhost:8765/tilbud-beregner/ (the booking section is at `#book`).

## Files

- `beregner/` and `tilbud-beregner/`: `index.html` (page, styles, copy) and `beregner.js` (questions, math, blurred preview, form, result, tracking)
- `booking.js`: Cal.com embed and first-touch UTM storage (shared with skytsystems.dk)
- `book/img/`, `public/favicons/`: images used by the pages

Every number uses only the visitor's answers (bucket midpoints); the workshop page adds our 2 hours a week promise, and the math is written out under "Sådan har vi regnet" on each result.

## Notes

- `WEBHOOK_URL` in `beregner/beregner.js` is empty, so submissions are only logged to the console.
- The Meta Pixel only loads on the live domain.
