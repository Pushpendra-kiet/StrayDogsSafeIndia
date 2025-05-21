const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'another-secure-secret';

exports.generateToken = (user) => {
  return jwt.sign({
    id: user._id,
    name: user.name,
    email: user.email
  }, JWT_SECRET, { expiresIn: '7d' });
};

exports.verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};
