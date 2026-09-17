require('dotenv').config();
const express = require('express');
const path = require('path');

const config = require('./config');
const db = require('./db');
const estimate = require('./estimate');
const ai = require('./ai');
const messaging = require('./messaging');
const { startFollowUpSchedule, runFollowUpSweep } = require('./followup');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/config', (req, res) => {
  res.json({
    businessId: config.businessId,
    businessName: config.businessName,
    laborRatePerHour: config.laborRatePerHour,
    tripFee: config.tripFee,
    materialsMarkupPercent: config.materialsMarkupPercent,
    jobTypes: config.jobTypes
  });
});

app.post('/api/estimate', (req, res) => {
  const result = estimate.computeEstimate(req.body);
  res.json(result);
});

app.post('/api/estimate/sanity-check', async (req, res) => {
  const note = await ai.sanityCheck(req.body);
  res.json({ note });
});

app.get('/api/quotes', (req, res) => {
  res.json(db.listQuotes());
});

app.post('/api/quotes', (req, res) => {
  const { name, phone, email, jobType, amount, scope } = req.body;
  if (!name || (!phone && !email) || !amount) {
    return res.status(400).json({ error: 'name, amount, and phone or email are required' });
  }
  const quote = db.createQuote({ name, phone, email, jobType, amount, scope });
  res.json(quote);
});

app.patch('/api/quotes/:id', (req, res) => {
  const quote = db.updateQuote(Number(req.params.id), req.body);
  if (!quote) return res.status(404).json({ error: 'not found' });
  res.json(quote);
});

app.post('/api/quotes/:id/draft', async (req, res) => {
  const quote = db.getQuote(Number(req.params.id));
  if (!quote) return res.status(404).json({ error: 'not found' });

  const days = Math.floor((Date.now() - new Date(quote.createdAt)) / (1000 * 60 * 60 * 24));
  const draft = await ai.draftFollowUp({
    name: quote.name,
    job: quote.jobType,
    amount: quote.amount,
    scope: quote.scope,
    days,
    stage: 1
  });

  const updated = db.updateQuote(quote.id, { draft });
  res.json(updated);
});

app.post('/api/quotes/:id/send', async (req, res) => {
  const quote = db.getQuote(Number(req.params.id));
  if (!quote) return res.status(404).json({ error: 'not found' });
  if (!quote.draft) return res.status(400).json({ error: 'generate a draft first' });

  const channel = req.body.channel;
  let result;
  if (channel === 'sms') {
    if (!quote.phone) return res.status(400).json({ error: 'no phone on this quote' });
    result = await messaging.sendText(quote.phone, quote.draft);
  } else if (channel === 'email') {
    if (!quote.email) return res.status(400).json({ error: 'no email on this quote' });
    result = await messaging.sendEmail(quote.email, `Following up on your ${quote.jobType} quote`, quote.draft);
  } else {
    return res.status(400).json({ error: 'channel must be sms or email' });
  }

  db.appendLog(quote.id, result.sent ? `Sent ${channel} automatically` : `${channel} opened via tap-to-send link`);
  res.json(result);
});

app.post('/api/followup/run-now', async (req, res) => {
  await runFollowUpSweep();
  res.json({ ok: true });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`${config.businessName} pipeline tool running on http://localhost:${port}`);
  startFollowUpSchedule();
});
