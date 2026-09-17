const config = require('./config');

function computeEstimate({ jobType, hours, complexity, materials, includeTrip }) {
  const jobDef = config.jobTypes.find(j => j.name === jobType);
  const h = Number(hours) || (jobDef ? jobDef.typicalHours : 1);
  const c = Number(complexity) || 1;
  const m = Number(materials) || 0;

  const laborCost = h * config.laborRatePerHour * c;
  const materialsCost = m * (1 + config.materialsMarkupPercent / 100);
  const tripFee = includeTrip ? config.tripFee : 0;
  const subtotal = laborCost + materialsCost + tripFee;

  return {
    jobType,
    hours: h,
    complexity: c,
    laborCost: round(laborCost),
    materialsCost: round(materialsCost),
    tripFee: round(tripFee),
    subtotal: round(subtotal),
    low: round(subtotal * 0.92),
    high: round(subtotal * 1.18)
  };
}

function round(n) {
  return Math.round(n * 100) / 100;
}

module.exports = { computeEstimate };
