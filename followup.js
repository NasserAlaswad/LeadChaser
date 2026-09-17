const cron = require('node-cron');
const config = require('./config');
const db = require('./db');
const ai = require('./ai');
const messaging = require('./messaging');

function daysSince(dateStr) {
  const then = new Date(dateStr);
  const now = new Date();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

function stageForDays(days) {
  const t = config.followUp.thresholdsDays;
  if (days >= t[2]) return 3;
  if (days >= t[1]) return 2;
  if (days >= t[0]) return 1;
  return 0;
}

async function runFollowUpSweep() {
  const quotes = db.listQuotes().filter(q => q.status === 'open');

  for (const q of quotes) {
    const days = daysSince(q.createdAt);
    const stage = stageForDays(days);
    if (stage === 0) continue;
    if (q.lastStageMessaged === stage) continue;

    const draft = await ai.draftFollowUp({
      name: q.name,
      job: q.jobType,
      amount: q.amount,
      scope: q.scope,
      days,
      stage
    });

    db.updateQuote(q.id, { draft, lastStageMessaged: stage });

    if (!config.followUp.autoSend) continue;

    if (config.followUp.autoSendChannel === 'sms' && q.phone) {
      const result = await messaging.sendText(q.phone, draft);
      db.appendLog(q.id, result.sent ? `Auto-sent text (stage ${stage})` : `Auto-send skipped, no SMS credentials (stage ${stage})`);
    } else if (config.followUp.autoSendChannel === 'email' && q.email) {
      const result = await messaging.sendEmail(q.email, `Following up on your ${q.jobType} quote`, draft);
      db.appendLog(q.id, result.sent ? `Auto-sent email (stage ${stage})` : `Auto-send skipped, no email credentials (stage ${stage})`);
    }
  }
}

function startFollowUpSchedule() {
  cron.schedule('0 9 * * *', () => {
    runFollowUpSweep().catch(err => console.error('Follow-up sweep failed:', err.message));
  }, { timezone: config.timezone || 'America/New_York' });
}

module.exports = { startFollowUpSchedule, runFollowUpSweep };
