const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const path = require('path');
const mongoose = require('mongoose');
const Complaint = require('./models/Complaint');
const session = require('express-session');
const passport = require('passport');
const crypto = require('crypto');
const Contact = require('./models/Contact');
require('./auth'); // import the passport config


const app = express();

app.use(session({
  secret: crypto.randomBytes(64).toString('hex'),
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

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

app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.use((req, res, next) => {
  res.locals.user = req.user;
  next();
});


app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/fail' }),
  function(req, res) {
    res.redirect('/dashboard');
  }
);
app.get('fail', (req,res)=>{
  res.render('test')
})

app.get('/dashboard', (req, res) => {
  if (!req.isAuthenticated()) return res.render('test');
    res.render('index');
});

app.get('/logout', (req, res) => {
  req.logout(() => {
    res.redirect('/');
  });
});

// Home route
app.get('/', (req, res) => {
  res.render('index');
});

// Home route
app.get('/raise-your-voice', (req, res) => {
  res.render('raise-your-voice');
});

app.get('/contact-us', (req, res) => {
  res.render('contact-us');
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
