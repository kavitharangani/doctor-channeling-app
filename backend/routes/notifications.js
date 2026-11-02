const express = require('express');
const store = require('../db/store');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

router.get('/', authRequired, (req, res) => {
  const items = store.getAll('notifications')
    .filter(n => n.userId === req.user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json(items);
});

router.patch('/:id/read', authRequired, (req, res) => {
  const n = store.findById('notifications', req.params.id);
  if (!n || n.userId !== req.user.id) return res.status(404).json({ error: 'Not found' });
  res.json(store.update('notifications', n.id, { read: true }));
});

router.patch('/read-all', authRequired, (req, res) => {
  const items = store.getAll('notifications').map(n => n.userId === req.user.id ? { ...n, read: true } : n);
  store.setAll('notifications', items);
  res.json({ ok: true });
});

module.exports = router;
