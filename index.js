require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const passport = require('passport');
const MongoStore = require('connect-mongo');
const crypto = require('crypto');
const axios = require('axios');

const Complaint = require('./models/Complaint');
const Contact = require('./models/Contact');
require('./auth'); // <- load passport config

const app = express();

// MongoDB connection
const mongoURI = 'mongodb+srv://pushpendrakumar:Realme%4012345@straydogsdata.d06bomp.mongodb.net/complaints';

mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => console.error('❌ Connection error:', err));

// Sessions
app.use(session({
  secret: process.env.SESSION_SECRET || 's0m3V3ryRand0mS3cretStr1ng!',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: mongoURI, collectionName: 'sessions' }),
  cookie: {
    secure: true,
    sameSite: 'none'
  }
}));

app.use(passport.initialize());
app.use(passport.session());

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use((req, res, next) => {
  res.locals.user = req.user;
  next();
});

// Routes
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/fail' }),
  (req, res) => res.redirect('/dashboard')
);

app.get('/fail', (req, res) => {
  res.render('test');
});

app.get('/dashboard', (req, res) => {
  if (!req.isAuthenticated()) return res.render('test');
  res.render('index');
});

app.get('/logout', (req, res) => {
  req.logout(() => res.redirect('/'));
});

// Public pages
app.get('/', (req, res) => res.render('index'));
app.get('/raise-your-voice', (req, res) => res.render('raise-your-voice'));
app.get('/contact-us', (req, res) => res.render('contact-us'));

app.get('/complaints', async (req, res) => {
  try {
    const complaints = await Complaint.find().sort({ createdAt: -1 }).limit(100);
    res.render('complaints', { complaints });
  } catch (err) {
    console.error(err);
    res.status(500).send('❌ Error fetching complaints');
  }
});

// Complaint form
app.post('/submit', async (req, res) => {
  const { message, doi, city, state, 'g-recaptcha-response': token } = req.body;

  if (!req.isAuthenticated()) {
    return res.render('nologin', { message: "⚠️ You must be logged in via Google to submit a complaint." });
  }

  const { name, email } = req.user;

  if (!token) return res.send('⚠️ reCAPTCHA token missing.');

  try {
    const response = await axios.post('https://www.google.com/recaptcha/api/siteverify', null, {
      params: {
        secret: '6LdCpz4rAAAAAD34Q_Dy2DbI7elrwnIcCfXWN6XU',
        response: token
      }
    });

    const data = response.data;
    if (!data.success || data.score < 0.5 || data.action !== 'submit') {
      return res.send('⚠️ Captcha failed.');
    }

    await Complaint.create({ name, email, message, doi, city, state });
    res.redirect('/');
  } catch (err) {
    console.error('Captcha error:', err);
    res.status(500).send('❌ Server error during captcha verification.');
  }
});

// Contact form
app.post('/contact-us', async (req, res) => {
  const { city, state, age, joinus, 'g-recaptcha-response': token } = req.body;

  if (!req.isAuthenticated()) {
    return res.render('nologin', { message: "⚠️ You must be logged in via Google to submit this form." });
  }

  const { name, email } = req.user;

  if (!token) return res.send('⚠️ reCAPTCHA token missing.');

  try {
    const response = await axios.post('https://www.google.com/recaptcha/api/siteverify', null, {
      params: {
        secret: '6LdCpz4rAAAAAD34Q_Dy2DbI7elrwnIcCfXWN6XU',
        response: token
      }
    });

    const data = response.data;
    if (!data.success || data.score < 0.5 || data.action !== 'submit') {
      return res.send('⚠️ Captcha failed.');
    }

    await Contact.create({
      name,
      email,
      city,
      state,
      age: parseInt(age, 10),
      joinus: joinus === 'on'
    });

    res.render('joined');
  } catch (err) {
    console.error('Captcha error:', err);
    res.status(500).send('❌ Server error during captcha verification.');
  }
});

// Server start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
