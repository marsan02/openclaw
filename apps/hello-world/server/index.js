const express = require('express');
const router = express.Router();

// In-memory stats
let greetCount = 0;

// GET /api/hello-world/greet
router.get('/greet', (req, res) => {
  const name = req.query.name || 'World';
  greetCount++;
  
  res.json({
    message: `👋 Hello, ${name}!`,
    timestamp: new Date().toISOString(),
    greetNumber: greetCount
  });
});

// GET /api/hello-world/stats
router.get('/stats', (req, res) => {
  res.json({
    totalGreets: greetCount,
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

module.exports = router;
