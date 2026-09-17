const MODEL = 'claude-sonnet-5';

async function callClaude(prompt, maxTokens) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return null;
  }
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  const data = await res.json();
  if (!data.content) return null;
  return data.content.map(b => b.text || '').join('').trim();
}

async function draftFollowUp({ name, job, amount, scope, days, stage }) {
  const tone = stage >= 3
    ? 'Final, direct follow-up. Polite but create light urgency.'
    : stage === 2
      ? 'Mid-sequence nudge. Friendly, offer to answer questions.'
      : 'First, soft follow-up. Warm, no pressure.';

  const prompt = `Write a short SMS/email-length follow-up message (under 55 words) from a small ${job.split(' ')[0].toLowerCase()} service business to a customer named ${name.split(' ')[0]} who received a quote of $${amount} for "${job}" (${scope}) ${days} days ago and has not responded. ${tone} Plain, human, no corporate tone, no em dashes. Output only the message text, no subject line.`;

  const text = await callClaude(prompt, 300);
  return text || fallbackDraft({ name, job, amount, days });
}

async function sanityCheck({ job, hours, materials, subtotal }) {
  const prompt = `You are reviewing a service quote estimate for a home service business (HVAC/plumbing/electrical). Job: ${job}. Estimated hours: ${hours}. Materials cost: $${materials}. Total suggested quote: $${subtotal}. In under 40 words, say plainly whether this looks in a reasonable range for this job type, and flag if anything seems off (too low, missing likely cost, etc). No preamble, just the assessment.`;

  const text = await callClaude(prompt, 200);
  return text || 'AI sanity-check unavailable right now — proceed with the calculated estimate.';
}

function fallbackDraft({ name, job, amount, days }) {
  const first = name.split(' ')[0];
  return `Hi ${first}, just checking in on the $${amount} quote for your ${job.toLowerCase()} from ${days} days ago. Happy to answer any questions or adjust anything — let me know if you'd like to move forward.`;
}

module.exports = { draftFollowUp, sanityCheck };
