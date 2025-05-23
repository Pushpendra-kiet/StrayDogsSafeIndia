const express = require('express');
const bodyParser = require('body-parser');
const { OAuth2Client } = require('google-auth-library');
const axios = require('axios');
const path = require('path');
const mongoose = require('mongoose');
const Complaint = require('./models/Complaint');
const session = require('express-session');
const crypto = require('crypto');
const Contact = require('./models/Contact');
const cookieParser = require('cookie-parser');
const { google } = require('googleapis');
//some

//CHANGES DONE
const app = express();

app.use(cookieParser());

const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);

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
app.use(express.static(__dirname + '/public'))
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Auth client
const auth = new google.auth.GoogleAuth({
  credentials: credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

// Your spreadsheet ID (from URL of Google Sheets)
const SID= process.env.SPREADSHEET_ID;


mongoose.connect('mongodb+srv://pushpendrakumar:Realme%4012345@straydogsdata.jp0ruon.mongodb.net/complaints', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  bufferTimeoutMS: 45000
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

const pollSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true }, // ensures one vote per user
  rating: Number,
  agreeSolution: String,
  joinMovement: String,
  submittedAt: { type: Date, default: Date.now }
});

const Poll = mongoose.model('Poll', pollSchema);

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
    res.clearCookie('user');
    res.redirect('/');
  });
});



// Home Route
app.get('/', (req, res) => {
  let user = null;

  if (req.session.user) {
    user = req.session.user;

    // Update the cookie just in case
    res.cookie('user', JSON.stringify(user), {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000
    });
  } else if (req.cookies.user) {
    // Parse user from cookie if session is missing
    try {
      user = JSON.parse(req.cookies.user);
    } catch (err) {
      console.error('Failed to parse user cookie:', err);
    }
  }

  res.render('index', { user });
});

// Home route
app.get('/raise-your-voice', (req, res) => {
    let user = null;

  if (req.session && req.session.user) {
    user = req.session.user;
  } else if (req.cookies && req.cookies.user) {
    try {
      user = JSON.parse(req.cookies.user);
    } catch (err) {
      console.error('Invalid cookie:', err);
    }
  }
  res.render('raise-your-voice',{ user });
});

app.get('/contact-us', (req, res) => {
    let user = null;

  if (req.session && req.session.user) {
    user = req.session.user;
  } else if (req.cookies && req.cookies.user) {
    try {
      user = JSON.parse(req.cookies.user);
    } catch (err) {
      console.error('Invalid cookie:', err);
    }
  }
  res.render('contact-us',{ user });
});

app.get('/complaints', async (req, res) => {

      let user = null;

  if (req.session && req.session.user) {
    user = req.session.user;
  } else if (req.cookies && req.cookies.user) {
    try {
      user = JSON.parse(req.cookies.user);
    } catch (err) {
      console.error('Invalid cookie:', err);
    }
  }

  try {
    const complaints = await Complaint.find().sort({ createdAt: -1 }).limit(10);
    res.render('complaints', { complaints, user });
  } catch (err) {
    console.error(err);
    res.status(500).send('❌ Error fetching complaints');
  }
});

// Form submission route
app.post('/submit', async (req, res) => {

  let user = null;

  if (req.session && req.session.user) {
    user = req.session.user;
  } else if (req.cookies && req.cookies.user) {
    try {
      user = JSON.parse(req.cookies.user);
    } catch (err) {
      console.error('Invalid cookie:', err);
    }
  }

  const { message, doi, city, state, 'g-recaptcha-response': token } = req.body;

  if (typeof user !== 'undefined' && user) {
  var myname = user.name;
  var myemail = user.email;  
  } else { 
   return res.render('/test')
  }

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
    await Complaint.create({ name: myname, message, city, state, doi, email:myemail });
    return res.redirect('/');

  } catch (err) {
    console.error('Captcha error:', err);
    res.status(500).send('❌ Server error during captcha verification.');
  }
});
//contact-us form
// Form submission route
app.post('/contact-us', async (req, res) => {

    let user = null;

  if (req.session && req.session.user) {
    user = req.session.user;
  } else if (req.cookies && req.cookies.user) {
    try {
      user = JSON.parse(req.cookies.user);
    } catch (err) {
      console.error('Invalid cookie:', err);
    }
  }

  const { city, state, age, joinus, 'g-recaptcha-response': token } = req.body;

   if (typeof user !== 'undefined' && user) {
  var myname = user.name;
  var myemail = user.email;  
  } else { 
   return res.render('/test')
  }

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
      name:myname,
      city,
      state,
      age: ageNum,
      email:myemail,
      joinus: joinusBool,
    });

    return res.render('joined',{user} );

  } catch (err) {
    console.error('Captcha error:', err);
    res.status(500).send('❌ Server error during captcha verification.');
  }
});

app.post('/poll', async (req, res) => {
  const { name, email, rating, agreeSolution, joinMovement } = req.body;

  if (!email) {
    return res.status(400).send("User not logged in or email missing.");
  }

  try {
    // Check if the user has already submitted a poll
    const existingEntry = await Poll.findOne({ email });

    if (existingEntry) {
      return res.send("आप पहले ही मतदान कर चुके हैं। धन्यवाद।");
    }

    // Save the new poll entry
    const newPoll = new Poll({ name, email, rating, agreeSolution, joinMovement });
    await newPoll.save();

    res.send("आपका मतदान सफलतापूर्वक दर्ज कर लिया गया है। धन्यवाद!");

  } catch (err) {
    console.error("Poll submission error:", err);
    res.status(500).send("कुछ गलत हो गया। कृपया पुनः प्रयास करें।");
  }
});


app.post('/submit-poll', async (req, res) => {
    let user = null;

  if (req.session && req.session.user) {
    user = req.session.user;
  } else if (req.cookies && req.cookies.user) {
    try {
      user = JSON.parse(req.cookies.user);
    } catch (err) {
      console.error('Invalid cookie:', err);
    }
  }
   if (typeof user !== 'undefined' && user) {
  var myname = user.name;
  var myemail = user.email;  
  } else { 
   return res.render('/test')
  }
  
  const { rating, q1, q2 } = req.body;

  try {
    const authClient = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: authClient });

    const row = [
      new Date().toLocaleString(),
      myname,
      myemail,
      rating,
      q1,
      q2,
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: '1YI0s9MprWcInk3Gol0w9Is5KCcYFTDRnGVNDPwwjRMw',
      range: 'poll_data',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [row],
      },
    });

    res.send('<h2>Thank you for your submission!</h2>');
  } catch (error) {
    console.error('Error submitting poll:', error);
    res.send('<h2>Something went wrong. Please try again.</h2>');
  }
});



// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
