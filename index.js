const express = require('express');
const bodyParser = require('body-parser');
const { OAuth2Client } = require('google-auth-library');
require('dotenv').config();
const axios = require('axios');
const path = require('path');
const mongoose = require('mongoose');
const Complaint = require('./models/Complaint');
const session = require('express-session');
const crypto = require('crypto');
const Contact = require('./models/Contact');
require('./auth'); // import the passport config

//CHANGES DONE
const app = express();

const client = new OAuth2Client(
  process.env.AUTH_CLIENT_ID,
  process.env.AUTH_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

//Middleware for handling sessions
app.use(
  session({
    secret: process.env.AUTH_SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

mongoose.connect('mongodb+srv://pushpendrakumar:Realme%4012345@straydogsdata.d06bomp.mongodb.net/complaints', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => console.error('❌ Connection error:', err));

app.get('/auth/google', (req, res) => {
  const url = client.generateAuthUrl({
    access_type: 'offline',
    scope: ['profile', 'email'],
  });
  res.redirect(url);
});

// Google OAuth Callback Route
app.get('/auth/google/callback', async (req, res) => {
  const code = req.query.code;

  if (!code) {
    return res.status(400).send('Invalid request. No authorization code provided.');
  }

  try {
    // Exchange authorization code for access token
    const { tokens } = await client.getToken(code);

    // Verify the token and get user information
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.AUTH_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    // Save user info in session
    req.session.user = {
      name: payload.name,
      email: payload.email,
      picture: payload.picture,
    };

    res.redirect('/');
  } catch (error) {
    console.error('Error during Google OAuth callback:', error);
    res.status(500).send('Authentication failed.');
  }
});

// Logout Route
app.get('/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).send('Failed to logout.');
    }
    res.redirect('/');
  });
});


// Home route
app.get('/', (req, res) => {
  res.render('index');
});

// Home route
app.get('/raise-your-voice', (req, res) => {
  res.render('raise-your-voice',{ user: req.session.user });
});

app.get('/contact-us', (req, res) => {
  res.render('contact-us',{ user: req.session.user });
});

app.get('/complaints', async (req, res) => {
  try {
    const complaints = await Complaint.find().sort({ createdAt: -1 }).limit(100);
    res.render('complaints', { complaints });
  } catch (err) {
    console.error(err);
    res.status(500).send('❌ Error fetching complaints');
  }
});

// Form submission route
app.post('/submit', async (req, res) => {
  const { message, doi, city, state, 'g-recaptcha-response': token } = req.body;

  // ✅ Reject if not logged in
  if (!req.isAuthenticated()) {
    return res.render('nologin', { message: "⚠️ You must be logged in via Google to submit a complaint." });
  }

const name = req.user.name;
const email = req.user.email;

  if (!token) {
    return res.send('⚠️ reCAPTCHA token missing.');
  }

  try {
    const secretKey = '6LdCpz4rAAAAAD34Q_Dy2DbI7elrwnIcCfXWN6XU';

    const response = await axios.post(
      `https://www.google.com/recaptcha/api/siteverify`,
      null,
      {
        params: {
          secret: secretKey,
          response: token,
        },
      }
    );

    const data = response.data;

    if (!data.success || data.score < 0.5 || data.action !== 'submit') {
      return res.send('⚠️ Captcha failed. Please try again or check for suspicious activity.');
    }

    // ✅ Save complaint with authenticated user's name
    await Complaint.create({ name, email, message, doi, city, state });
    return res.redirect('/');

  } catch (err) {
    console.error('Captcha error:', err);
    res.status(500).send('❌ Server error during captcha verification.');
  }
});
//contact-us form
// Form submission route
app.post('/contact-us', async (req, res) => {
  const { city, state, age, joinus, 'g-recaptcha-response': token } = req.body;

  if (!req.isAuthenticated()) {
    return res.render('nologin', { message: "⚠️ You must be logged in via Google to submit this form." });
  }

  const name = req.user.name;
  const email = req.user.email;

  if (!token) {
    return res.send('⚠️ reCAPTCHA token missing.');
  }

  try {
    const secretKey = '6LdCpz4rAAAAAD34Q_Dy2DbI7elrwnIcCfXWN6XU';

    const response = await axios.post(
      `https://www.google.com/recaptcha/api/siteverify`,
      null,
      {
        params: {
          secret: secretKey,
          response: token,
        },
      }
    );

    const data = response.data;

    if (!data.success || data.score < 0.5 || data.action !== 'submit') {
      return res.send('⚠️ Captcha failed. Please try again or check for suspicious activity.');
    }

    const ageNum = parseInt(age, 10);
    const joinusBool = joinus === 'on';

    await Contact.create({
      name,
      email,
      city,
      state,
      age: ageNum,
      joinus: joinusBool,
    });

    return res.render('joined');

  } catch (err) {
    console.error('Captcha error:', err);
    res.status(500).send('❌ Server error during captcha verification.');
  }
});



// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
