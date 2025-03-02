// Global variables for charts.
let sensitivityChart = null;
let summaryChart = null;

// Toggle model section based on dropdown selection.
function toggleSection() {
  const model = document.getElementById('modelSelect').value;
  document.getElementById('simpleSection').style.display = (model === 'simple') ? 'block' : 'none';
  document.getElementById('advancedSection').style.display = (model === 'advanced') ? 'block' : 'none';
  document.getElementById('customSection').style.display = (model === 'custom') ? 'block' : 'none';
}

// Dark mode toggle.
function toggleTheme() {
  document.body.classList.toggle('dark');
}

/* Utility: Clamp value */
function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/* Sigmoid-based risk mapping (returns a value between 1 and 10) */
function calculateRiskLevel(metric, metricMin, metricMax) {
  const mid = (metricMin + metricMax) / 2;
  const alpha = 10 / (metricMax - metricMin);
  const sigmoid = 1 / (1 + Math.exp(-alpha * (metric - mid)));
  return 1 + 9 * sigmoid;
}

/* Map risk level to stop loss percentage and TP multiplier */
function riskParameters(riskLevel) {
  const stopLossPct = 30 - (riskLevel - 1) * (20 / 9);
  const tpMultiplier = 3 - (riskLevel - 1) * (2 / 9);
  return { stopLossPct, tpMultiplier };
}

/* Convert risk level to qualitative label */
function riskLabel(riskLevel) {
  if (riskLevel <= 3) return "Favorable";
  if (riskLevel <= 7) return "Neutral";
  return "Risk";
}

/* SIMPLE MODEL CALCULATION */
function calculateSimple() {
  const P = parseFloat(document.getElementById('s_price').value);
  const delta = parseFloat(document.getElementById('s_delta').value);
  const atr = parseFloat(document.getElementById('s_atr').value);
  const T_days = parseFloat(document.getElementById('s_tdays').value);
  
  const riskFactor = delta * atr;
  const T_factor = 1 / (1 + Math.exp((T_days - 30) / 5));
  const riskMetric = (riskFactor / P) * T_factor;
  
  const metricMin = 0.1, metricMax = 0.5;
  const riskLevel = calculateRiskLevel(riskMetric, metricMin, metricMax);
  const { stopLossPct, tpMultiplier } = riskParameters(riskLevel);
  
  const stopLoss = P - (stopLossPct / 100) * P;
  const takeProfit = P + tpMultiplier * ((stopLossPct / 100) * P);
  const label = riskLabel(riskLevel);
  
  document.getElementById('simpleResult').innerHTML = `
    <strong>Simple Model Results:</strong><br>
    Risk Metric: ${riskMetric.toFixed(3)}<br>
    Auto Risk Level: ${riskLevel.toFixed(1)} (${label})<br>
    Stop Loss: $${stopLoss.toFixed(2)} (${stopLossPct.toFixed(1)}% below entry)<br>
    Take Profit: $${takeProfit.toFixed(2)}
  `;
  
  updateSummaryChart(P, T_days, stopLoss, takeProfit, 0, "simple");
}

/* ADVANCED MODEL CALCULATION */
function calculateAdvanced() {
  const P = parseFloat(document.getElementById('a_price').value);
  const delta = parseFloat(document.getElementById('a_delta').value);
  const theta = parseFloat(document.getElementById('a_theta').value);
  const iv = parseFloat(document.getElementById('a_iv').value);
  const atr = parseFloat(document.getElementById('a_atr').value);
  const ms = parseFloat(document.getElementById('a_ms').value);
  const S = parseFloat(document.getElementById('a_stock').value);
  const T_days = parseFloat(document.getElementById('a_tdays').value);
  const OI = parseFloat(document.getElementById('a_oi').value);
  const contracts = parseFloat(document.getElementById('a_contracts').value);
  
  const numerator = delta * atr * (S / P) * Math.sqrt(OI + 1) *
                    Math.log(T_days + 1) * (1 + ((ms - 50) / 50));
  const denominator = P * Math.sqrt(theta) * Math.exp(iv / 100);
  const Q = Math.sqrt(numerator / denominator);
  
  const metricMin = 0.2, metricMax = 1.0;
  const riskLevel = calculateRiskLevel(Q, metricMin, metricMax);
  const { stopLossPct, tpMultiplier } = riskParameters(riskLevel);
  
  const stopLoss = P * (1 - contracts * Q * (stopLossPct / 100));
  const takeProfit = P * (1 + contracts * Q * (stopLossPct / 100) * tpMultiplier);
  const rrRatio = ((takeProfit - P) / (P - stopLoss)).toFixed(2);
  const label = riskLabel(riskLevel);
  
  document.getElementById('advancedResult').innerHTML = `
    <strong>Advanced Model Results:</strong><br>
    Composite Sensitivity Score (Q): ${Q.toFixed(4)}<br>
    Auto Risk Level: ${riskLevel.toFixed(1)} (${label})<br>
    Stop Loss: $${stopLoss.toFixed(2)} (${stopLossPct.toFixed(1)}% below entry)<br>
    Take Profit: $${takeProfit.toFixed(2)}<br>
    Risk/Reward Ratio: ${rrRatio}
  `;
  
  updateSummaryChart(P, T_days, stopLoss, takeProfit, theta, "advanced");
}

/* CUSTOM (WEIGHTED) MODEL CALCULATION */
function calculateCustom() {
  const P = parseFloat(document.getElementById('c_price').value);
  const theta = parseFloat(document.getElementById('c_theta').value);
  const iv = parseFloat(document.getElementById('c_iv').value);
  const contracts = parseFloat(document.getElementById('c_contracts').value);
  
  const delta = parseFloat(document.getElementById('c_delta').value);
  const w_delta = parseFloat(document.getElementById('w_delta').value);
  
  const atr = parseFloat(document.getElementById('c_atr').value);
  const w_atr = parseFloat(document.getElementById('w_atr').value);
  
  const S = parseFloat(document.getElementById('c_stock').value);
  const optPriceForRatio = parseFloat(document.getElementById('c_optionPrice').value);
  const w_ratio = parseFloat(document.getElementById('w_ratio').value);
  
  const OI = parseFloat(document.getElementById('c_oi').value);
  const w_oi = parseFloat(document.getElementById('w_oi').value);
  
  const T_days = parseFloat(document.getElementById('c_tdays').value);
  const w_tdays = parseFloat(document.getElementById('w_tdays').value);
  
  const ms = parseFloat(document.getElementById('c_ms').value);
  const w_ms = parseFloat(document.getElementById('w_ms').value);
  
  const slMult = parseFloat(document.getElementById('c_slMult').value);
  const tpMult = parseFloat(document.getElementById('c_tpMult').value);
  
  const weightedDelta = w_delta * delta;
  const weightedATR = w_atr * atr;
  const weightedRatio = w_ratio * (S / optPriceForRatio);
  const weightedOI = Math.sqrt(w_oi * (OI + 1));
  const weightedT = Math.log(w_tdays * (T_days + 1));
  const weightedMS = 1 + (w_ms * (ms - 50) / 50);
  
  const numerator = weightedDelta * weightedATR * weightedRatio * weightedOI * weightedT * weightedMS;
  const denominator = P * theta * Math.exp(iv / 100);
  const Q_custom = Math.sqrt(numerator / denominator);
  
  const metricMin = 0.2, metricMax = 1.0;
  const riskLevel = calculateRiskLevel(Q_custom, metricMin, metricMax);
  const { stopLossPct, tpMultiplier } = riskParameters(riskLevel);
  
  const stopLoss = P * (1 - slMult * contracts * Q_custom * (stopLossPct / 100));
  const takeProfit = P * (1 + tpMultiplier * contracts * Q_custom * (stopLossPct / 100));
  const rrRatio = ((takeProfit - P) / (P - stopLoss)).toFixed(2);
  const label = riskLabel(riskLevel);
  
  document.getElementById('customResult').innerHTML = `
    <strong>Custom Model Results:</strong><br>
    Weighted Composite Score (Q_custom): ${Q_custom.toFixed(4)}<br>
    Auto Risk Level: ${riskLevel.toFixed(1)} (${label})<br>
    Stop Loss: $${stopLoss.toFixed(2)} (${stopLossPct.toFixed(1)}% below entry)<br>
    Take Profit: $${takeProfit.toFixed(2)}<br>
    Risk/Reward Ratio: ${rrRatio}
  `;
  
  updateSummaryChart(P, T_days, stopLoss, takeProfit, theta, "advanced");
}
