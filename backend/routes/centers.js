const express = require('express');
const store = require('../db/store');

const router = express.Router();

// GET /api/centers
router.get('/', (req, res) => {
  res.json(store.getAll('centers').filter(c => c.active !== false));
});

module.exports = router;
