# Quote & Estimate Pipeline Tool

A small business tool that turns a quote into a priced estimate, tracks it in a pipeline, and generates + sends AI-drafted follow-up messages on a schedule. Built for home service businesses (HVAC, plumbing, electrical) but works for any business that quotes jobs and loses deals to silence.

## What it does

- Calculates a suggested quote from job type, hours, materials, and complexity, using rates you set once in a config file
- Optional AI sanity-check on any estimate before you send it
- Tracks every quote in a pipeline: open, won, lost
- Flags quotes due for follow-up at 1, 3, and 7 days
- Generates a personalized follow-up message per quote
- Sends automatically via Twilio (SMS) or SendGrid (email) if configured — otherwise opens a tap-to-send link in the customer's phone or email app
- Runs a daily scheduled sweep to catch every quote that's gone quiet, no manual checking required

Simple Breakdown 

Customer calls/texts/visits website
          ↓
AI receptionist answers
          ↓
Collects customer information
          ↓
Asks questions about the job
          ↓
Determines approximate job type
          ↓
Provides estimated price or range
          ↓
Schedules appointment
          ↓
Creates quote in your pipeline
          ↓
Sends confirmation SMS/email
          ↓
Sends reminders
          ↓
You only handle completed/complex jobs


## Setup

```bash
git clone <this-repo>
cd quote-pipeline-tool
npm install
cp .env.example .env
cp config/business.example.json config/business.json
```

Edit `.env`:
- `ANTHROPIC_API_KEY` — required for AI-drafted follow-ups and sanity-checks
- `TWILIO_*` and `SENDGRID_*` — optional, only needed for fully automatic sending. Leave blank to use tap-to-send links instead.

Edit `config/business.json`:
- `businessName`, `laborRatePerHour`, `tripFee`, `materialsMarkupPercent`
- `jobTypes` — the list of jobs this business quotes, each with a typical hours estimate
- `followUp.thresholdsDays` — when follow-ups trigger
- `followUp.autoSend` — `true` to send automatically on schedule, `false` to only draft and wait for a manual tap

Then run:

```bash
npm start
```

Visit `http://localhost:3000`.

## Applying this to a new business

This project is designed so a new client is a config change, not a code change:

1. Copy `config/business.example.json` to a new file (or overwrite `business.json`)
2. Fill in that business's rates and job types
3. Deploy — no code edits needed

Each business's quote data is stored separately under `data/<businessId>.json`, keyed off `businessId` in the config, so the same codebase can be redeployed per client without data collisions.

## Project structure

```
server/
  index.js       API routes + server startup
  config.js      loads config/business.json
  db.js          quote storage (JSON file, no external database needed)
  estimate.js    cost calculation logic
  ai.js          AI-drafted follow-ups + sanity-check via Anthropic API
  messaging.js   Twilio/SendGrid sending, with tap-to-send fallback
  followup.js    daily cron sweep for quotes due a follow-up
public/
  index.html, app.js, styles.css   the dashboard UI
config/
  business.example.json           copy this per business
data/
  <businessId>.json               created automatically, one file per business
```

## Notes

- Storage is a flat JSON file per business — fine for a single business's quote volume. Swap `server/db.js` for a real database if you scale past that.
- The AI model used is `claude-sonnet-5` — update the `MODEL` constant in `server/ai.js` if a newer model should be used.
- No SMS/email will send automatically without Twilio/SendGrid credentials in `.env`. This is intentional: sending on someone's behalf requires their own verified sender identity, not something to fake.
