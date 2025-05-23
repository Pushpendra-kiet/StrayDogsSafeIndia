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

app.post('/submit-complaints', async (req, res) => {

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
    return res.render('/test');
  }

  const { message, doi, city, state } = req.body;
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

    const authClient = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: authClient });

    const row = [
      new Date().toLocaleString(), // Timestamp
      myemail,
      myname,
      message,
      doi,
      city,
      state,
    ];
    await sheets.spreadsheets.values.append({
      spreadsheetId: '17IAiZgj9jWjf7gmVKkCv2YgZMIN_uOFSrU-pOtVgapA',
      range: 'voices', // Change to your desired sheet name
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [row],
      },
    });

    // On success, render a confirmation or redirect
    res.send('thank-you'); // Replace with your actual success page
  } catch (error) {
    console.error('Error submitting complaint:', error);
    res.status(500).send('Something went wrong while submitting the complaint.');
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
    return res.render('/test');
  }

  const { rating, q1, q2 } = req.body;

  try {
    const authClient = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: authClient });

    // Step 1: Fetch existing data
    const readRes = await sheets.spreadsheets.values.get({
      spreadsheetId: '1YI0s9MprWcInk3Gol0w9Is5KCcYFTDRnGVNDPwwjRMw',
      range: 'poll_data',
    });

    const rows = readRes.data.values || [];

    // Step 2: Check if email already exists in column 3 (index 2)
    const alreadyVoted = rows.some(row => row[2] === myemail);

    if (alreadyVoted) {
      return res.send('<h2>आप पहले ही मतदान कर चुके हैं। केवल एक बार मतदान की अनुमति है।</h2>');
    }

    // Step 3: Append new row
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

    res.send('<h2>धन्यवाद! आपका मतदान सफलतापूर्वक सबमिट हो गया है।</h2>');

  } catch (error) {
    console.error('Error submitting poll:', error);
    res.send('<h2>कुछ गलत हो गया। कृपया पुनः प्रयास करें।</h2>');
  }
});


// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
