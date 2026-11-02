const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuid } = require('uuid');
const store = require('../db/store');
const { JWT_SECRET, authRequired } = require('../middleware/auth');

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, name: user.name, email: user.email, doctorId: user.doctorId || null },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function publicUser(u) {
  const { passwordHash, ...rest } = u;
  return rest;
}

// Public registration -> always creates a "patient" account.
// Doctor/admin accounts are provisioned by an admin (see /api/admin/users).
router.post('/register', (req, res) => {
  const { name, email, password, phone } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email, password are required' });
  }
  const users = store.getAll('users');
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(409).json({ error: 'Email already registered' });
  }
  const user = {
    id: uuid(),
    role: 'patient',
    name,
    email,
    phone: phone || '',
    passwordHash: bcrypt.hashSync(password, 10),
    createdAt: new Date().toISOString()
  };
  store.insert('users', user);
  const token = signToken(user);
  res.status(201).json({ token, user: publicUser(user) });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  const users = store.getAll('users');
  const user = users.find(u => u.email.toLowerCase() === (email || '').toLowerCase());
  if (!user || !bcrypt.compareSync(password || '', user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const token = signToken(user);
  res.json({ token, user: publicUser(user) });
});

router.get('/me', authRequired, (req, res) => {
  const user = store.findById('users', req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: publicUser(user) });
});

module.exports = router;
