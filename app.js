let businessConfig = null;
let quotes = [];
let lastEstimate = null;

function fmtMoney(n) {
  return '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

async function init() {
  businessConfig = await fetch('/api/config').then(r => r.json());
  document.getElementById('businessName').textContent = businessConfig.businessName;

  const jobSelect = document.getElementById('eJob');
  jobSelect.innerHTML = businessConfig.jobTypes.map(j => `<option value="${j.name}">${j.name}</option>`).join('');
  jobSelect.addEventListener('change', () => {
    const jt = businessConfig.jobTypes.find(j => j.name === jobSelect.value);
    document.getElementById('eHours').value = jt ? jt.typicalHours : 1;
  });
  document.getElementById('eHours').value = businessConfig.jobTypes[0]?.typicalHours || 1;

  document.getElementById('configView').innerHTML = `
    <div class="config-row"><span>Labor rate</span><span>${fmtMoney(businessConfig.laborRatePerHour)}/hr</span></div>
    <div class="config-row"><span>Trip fee</span><span>${fmtMoney(businessConfig.tripFee)}</span></div>
    <div class="config-row"><span>Materials markup</span><span>${businessConfig.materialsMarkupPercent}%</span></div>
  `;

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('pane-' + btn.dataset.tab).classList.add('active');
    });
  });

  document.getElementById('calcBtn').addEventListener('click', calcEstimate);
  document.getElementById('aiCheckBtn').addEventListener('click', aiSanityCheck);

  await loadQuotes();
}

async function calcEstimate() {
  const body = {
    jobType: document.getElementById('eJob').value,
    hours: parseFloat(document.getElementById('eHours').value),
    complexity: parseFloat(document.getElementById('eComplexity').value),
    materials: parseFloat(document.getElementById('eMaterials').value) || 0,
    includeTrip: document.getElementById('eTrip').checked
  };

  lastEstimate = await fetch('/api/estimate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).then(r => r.json());

  document.getElementById('breakdownArea').innerHTML = `
    <div class="breakdown">
      <div class="bline"><span>Labor (${lastEstimate.hours}h × ${fmtMoney(businessConfig.laborRatePerHour)}/h × ${lastEstimate.complexity}x)</span><span>${fmtMoney(lastEstimate.laborCost)}</span></div>
      <div class="bline"><span>Materials (+${businessConfig.materialsMarkupPercent}% markup)</span><span>${fmtMoney(lastEstimate.materialsCost)}</span></div>
      ${body.includeTrip ? `<div class="bline"><span>Trip / callout fee</span><span>${fmtMoney(lastEstimate.tripFee)}</span></div>` : ''}
      <div class="bline total"><span>Suggested quote</span><span>${fmtMoney(lastEstimate.subtotal)}</span></div>
      <div class="brange">${fmtMoney(lastEstimate.low)} – ${fmtMoney(lastEstimate.high)} range</div>
      <div id="aiNoteArea"></div>
      <button class="primary" id="addToPipelineBtn">Add to pipeline as quote</button>
    </div>
  `;
  document.getElementById('addToPipelineBtn').addEventListener('click', addEstimateToPipeline);
  document.getElementById('aiCheckBtn').style.display = 'block';
}

async function aiSanityCheck() {
  if (!lastEstimate) return;
  const btn = document.getElementById('aiCheckBtn');
  btn.disabled = true;
  btn.textContent = 'Checking...';

  const note = await fetch('/api/estimate/sanity-check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      job: lastEstimate.jobType,
      hours: lastEstimate.hours,
      materials: lastEstimate.materialsCost,
      subtotal: lastEstimate.subtotal
    })
  }).then(r => r.json());

  const area = document.getElementById('aiNoteArea');
  if (area) area.innerHTML = `<div class="ai-note">${note.note}</div>`;
  btn.disabled = false;
  btn.textContent = 'AI sanity-check this estimate';
}

async function addEstimateToPipeline() {
  if (!lastEstimate) return;
  const name = document.getElementById('eName').value.trim();
  const phone = document.getElementById('ePhone').value.trim();
  const email = document.getElementById('eEmail').value.trim();
  if (!name) { alert('Add a customer name first.'); return; }
  if (!phone && !email) { alert('Add a phone or email so a follow-up can actually be sent.'); return; }

  const scope = `${lastEstimate.hours}h · ${fmtMoney(lastEstimate.materialsCost)} materials`;

  await fetch('/api/quotes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name, phone, email,
      jobType: lastEstimate.jobType,
      amount: lastEstimate.subtotal,
      scope
    })
  });

  document.getElementById('eName').value = '';
  document.getElementById('ePhone').value = '';
  document.getElementById('eEmail').value = '';
  document.getElementById('eMaterials').value = '';
  document.getElementById('breakdownArea').innerHTML = '';
  document.getElementById('aiCheckBtn').style.display = 'none';
  lastEstimate = null;

  await loadQuotes();
}

async function loadQuotes() {
  quotes = await fetch('/api/quotes').then(r => r.json());
  render();
}

function daysSince(dateStr) {
  return Math.floor((Date.now() - new Date(dateStr)) / (1000 * 60 * 60 * 24));
}

function followUpStage(days) {
  const t = businessConfig.jobTypes ? [1, 3, 7] : [1, 3, 7];
  if (days >= t[2]) return { label: 'Due — 7 day follow-up', due: true };
  if (days >= t[1]) return { label: 'Due — 3 day follow-up', due: true };
  if (days >= t[0]) return { label: 'Due — 1 day follow-up', due: true };
  return { label: 'Scheduled — first follow-up at 24h', due: false };
}

function renderStats() {
  const open = quotes.filter(q => q.status === 'open');
  const closed = quotes.filter(q => q.status === 'closed');
  document.getElementById('statOpenValue').textContent = fmtMoney(open.reduce((s, q) => s + q.amount, 0));
  document.getElementById('statDue').textContent = open.filter(q => followUpStage(daysSince(q.createdAt)).due).length;
  document.getElementById('statRecovered').textContent = fmtMoney(closed.reduce((s, q) => s + q.amount, 0));
}

function render() {
  const area = document.getElementById('listArea');
  if (quotes.length === 0) {
    area.innerHTML = '<div class="empty">No quotes yet. Build an estimate on the left, then add it to the pipeline.</div>';
    renderStats();
    return;
  }

  area.innerHTML = quotes.slice().reverse().map(q => {
    const days = daysSince(q.createdAt);
    const stage = followUpStage(days);
    let badgeHtml;
    if (q.status === 'closed') badgeHtml = '<span class="badge closed">Won</span>';
    else if (q.status === 'lost') badgeHtml = '<span class="badge lost">Lost</span>';
    else if (stage.due) badgeHtml = `<span class="badge due">${stage.label}</span>`;
    else badgeHtml = `<span class="badge scheduled">${stage.label}</span>`;

    const draftHtml = q.draft ? `<div class="draft-box"><span class="draft-label">DRAFT FOLLOW-UP MESSAGE</span>${q.draft}</div>` : '';
    const logHtml = (q.log || []).map(l => `<div class="log-line">${l.line} — ${new Date(l.at).toLocaleString()}</div>`).join('');

    const actions = q.status === 'open' ? `
      <div class="quote-actions">
        <button class="gen" onclick="generateDraft(${q.id})">Generate follow-up</button>
        <button class="text" ${q.phone ? '' : 'disabled'} onclick="sendVia(${q.id}, 'sms')">Send text</button>
        <button class="mail" ${q.email ? '' : 'disabled'} onclick="sendVia(${q.id}, 'email')">Send email</button>
        <button class="win" onclick="setStatus(${q.id}, 'closed')">Mark won</button>
        <button class="lose" onclick="setStatus(${q.id}, 'lost')">Mark lost</button>
      </div>` : '';

    return `<div class="quote-card">
      <div class="quote-top">
        <div>
          <div class="quote-name">${q.name}</div>
          <div class="quote-meta">${q.jobType} · quoted ${days} day${days === 1 ? '' : 's'} ago${q.phone ? ' · ' + q.phone : ''}${q.email ? ' · ' + q.email : ''}</div>
          <div class="quote-scope">${q.scope || ''}</div>
          ${badgeHtml}
        </div>
        <div class="quote-amount">${fmtMoney(q.amount)}</div>
      </div>
      ${actions}
      ${draftHtml}
      ${logHtml}
    </div>`;
  }).join('');

  renderStats();
}

async function setStatus(id, status) {
  await fetch(`/api/quotes/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
  await loadQuotes();
}

async function generateDraft(id) {
  await fetch(`/api/quotes/${id}/draft`, { method: 'POST' });
  await loadQuotes();
}

async function sendVia(id, channel) {
  const result = await fetch(`/api/quotes/${id}/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel })
  }).then(r => r.json());

  if (result.fallbackUrl) {
    window.location.href = result.fallbackUrl;
  }
  await loadQuotes();
}

init();
