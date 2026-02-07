const express = require('express');
const router = express.Router();

// Calculate monthly payment using French amortization formula
function calculateMonthlyPayment(principal, annualRate, termMonths) {
  const monthlyRate = annualRate / 100 / 12;
  if (monthlyRate === 0) return principal / termMonths;
  return principal * (monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / 
         (Math.pow(1 + monthlyRate, termMonths) - 1);
}

// Generate full amortization schedule
function generateAmortizationSchedule(principal, annualRate, termMonths, extraPayments = []) {
  const monthlyRate = annualRate / 100 / 12;
  let balance = principal;
  let totalInterest = 0;
  let totalPaid = 0;
  const schedule = [];
  
  // Sort extra payments by month
  const extras = [...extraPayments].sort((a, b) => a.month - b.month);
  let extraIndex = 0;
  
  // Calculate base monthly payment
  let monthlyPayment = calculateMonthlyPayment(principal, annualRate, termMonths);
  let currentMonthlyPayment = monthlyPayment;
  
  for (let month = 1; month <= termMonths && balance > 0.01; month++) {
    // Check for extra payment this month
    let extraPayment = 0;
    let reducePayment = false;
    
    while (extraIndex < extras.length && extras[extraIndex].month === month) {
      extraPayment += extras[extraIndex].amount;
      reducePayment = extras[extraIndex].reducePayment || reducePayment;
      extraIndex++;
    }
    
    // Apply extra payment to principal first
    if (extraPayment > 0) {
      balance -= extraPayment;
      totalPaid += extraPayment;
      
      if (balance <= 0) {
        schedule.push({
          month,
          payment: extraPayment + balance, // Adjust if overpaid
          principal: extraPayment + balance,
          interest: 0,
          extraPayment,
          balance: 0
        });
        break;
      }
      
      // Recalculate monthly payment if reducing payment option chosen
      if (reducePayment) {
        const remainingMonths = termMonths - month;
        currentMonthlyPayment = calculateMonthlyPayment(balance, annualRate, remainingMonths);
      }
    }
    
    // Calculate interest for this month
    const interestPayment = balance * monthlyRate;
    
    // Determine actual payment (might be less if near end)
    const actualPayment = Math.min(currentMonthlyPayment, balance + interestPayment);
    const principalPayment = actualPayment - interestPayment;
    
    balance -= principalPayment;
    totalInterest += interestPayment;
    totalPaid += actualPayment;
    
    schedule.push({
      month,
      payment: actualPayment,
      principal: principalPayment,
      interest: interestPayment,
      extraPayment,
      balance: Math.max(0, balance)
    });
    
    if (balance <= 0.01) break;
  }
  
  return {
    schedule,
    summary: {
      totalPaid: Math.round(totalPaid * 100) / 100,
      totalInterest: Math.round(totalInterest * 100) / 100,
      totalPrincipal: principal,
      monthsToPayoff: schedule.length,
      finalMonthlyPayment: currentMonthlyPayment
    }
  };
}

// POST /api/mortgage-simulator/calculate
router.post('/calculate', (req, res) => {
  try {
    const { principal, annualRate, termYears } = req.body;
    
    if (!principal || !annualRate || !termYears) {
      return res.status(400).json({ error: 'Missing required fields: principal, annualRate, termYears' });
    }
    
    const termMonths = termYears * 12;
    const monthlyPayment = calculateMonthlyPayment(principal, annualRate, termMonths);
    const { schedule, summary } = generateAmortizationSchedule(principal, annualRate, termMonths);
    
    res.json({
      input: { principal, annualRate, termYears, termMonths },
      monthlyPayment: Math.round(monthlyPayment * 100) / 100,
      summary,
      // Only send yearly summaries to reduce payload
      yearlyBreakdown: schedule.filter((_, i) => (i + 1) % 12 === 0 || i === schedule.length - 1)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/mortgage-simulator/compare
router.post('/compare', (req, res) => {
  try {
    const { principal, annualRate, termYears, scenarios } = req.body;
    
    if (!principal || !annualRate || !termYears) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const termMonths = termYears * 12;
    
    // Base scenario (no extra payments)
    const base = generateAmortizationSchedule(principal, annualRate, termMonths);
    
    // Calculate each scenario
    const results = scenarios.map((scenario, index) => {
      const extraPayments = scenario.payments.map(p => ({
        month: p.month,
        amount: p.amount,
        reducePayment: scenario.strategy === 'reduce-payment'
      }));
      
      const result = generateAmortizationSchedule(principal, annualRate, termMonths, extraPayments);
      
      const totalExtraPayments = scenario.payments.reduce((sum, p) => sum + p.amount, 0);
      
      return {
        id: index + 1,
        name: scenario.name || `Scenario ${index + 1}`,
        strategy: scenario.strategy,
        extraPayments: scenario.payments,
        totalExtraPayments,
        summary: result.summary,
        interestSaved: Math.round((base.summary.totalInterest - result.summary.totalInterest) * 100) / 100,
        monthsSaved: base.summary.monthsToPayoff - result.summary.monthsToPayoff,
        netSavings: Math.round((base.summary.totalInterest - result.summary.totalInterest - totalExtraPayments) * 100) / 100
      };
    });
    
    res.json({
      input: { principal, annualRate, termYears, termMonths },
      baseScenario: {
        monthlyPayment: Math.round(calculateMonthlyPayment(principal, annualRate, termMonths) * 100) / 100,
        summary: base.summary
      },
      scenarios: results
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/mortgage-simulator/quick-calc
router.get('/quick-calc', (req, res) => {
  const { principal, rate, years } = req.query;
  
  if (!principal || !rate || !years) {
    return res.status(400).json({ error: 'Provide principal, rate, years as query params' });
  }
  
  const p = parseFloat(principal);
  const r = parseFloat(rate);
  const y = parseInt(years);
  
  const monthlyPayment = calculateMonthlyPayment(p, r, y * 12);
  const totalPaid = monthlyPayment * y * 12;
  const totalInterest = totalPaid - p;
  
  res.json({
    principal: p,
    annualRate: r,
    termYears: y,
    monthlyPayment: Math.round(monthlyPayment * 100) / 100,
    totalPaid: Math.round(totalPaid * 100) / 100,
    totalInterest: Math.round(totalInterest * 100) / 100
  });
});

module.exports = router;
