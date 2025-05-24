const express = require('express');
const bodyParser = require('body-parser');
const { OAuth2Client } = require('google-auth-library');
const axios = require('axios');
const path = require('path');
const session = require('express-session');
const crypto = require('crypto');
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

async function fetchComplaints() {
  const authClient = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: authClient });

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: '17IAiZgj9jWjf7gmVKkCv2YgZMIN_uOFSrU-pOtVgapA',
    range: 'voices', // Sheet name
  });

  const rows = response.data.values || [];

  return rows
    .slice(1) // Skip header
    .map(row => ({
      createdAt: new Date(row[0]),
      email: row[1] || '',
      name: row[2] || 'Anonymous',
      message: row[3] || '',
      doi: new Date(row[4]) || '',
      city: row[5] || '',
      state: row[6] || ''
    }))
    .sort((a, b) => b.createdAt - a.createdAt); // Latest first
}

// GET /complaints (initial render)
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
    const page = 1;
    const limit = 10;
    const allComplaints = await fetchComplaints();
    const start = (page - 1) * limit;
    const paginated = allComplaints.slice(start, start + limit);

    res.render('complaints', {
      complaints: paginated,
      hasMore: start + limit < allComplaints.length,
      user: user || null,
    });
  } catch (err) {
    console.error('Error loading complaints:', err);
    res.status(500).send('Server error.');
  }
});

// GET /complaints/api?page=2
app.get('/complaints/api', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const allComplaints = await fetchComplaints();
    const start = (page - 1) * limit;
    const paginated = allComplaints.slice(start, start + limit);

    res.json({
      complaints: paginated,
      hasMore: start + limit < allComplaints.length,
    });
  } catch (err) {
    console.error('API Error:', err);
    res.status(500).json({ error: 'Failed to fetch complaints' });
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

  const { message, doi, city, state, 'g-recaptcha-response': token } = req.body;
    if (!token) {
    return res.send('<h2>⚠️ reCAPTCHA token missing.</h2><a href="https://saftefy-from-stray-dogs.vercel.app/contact-us">Home</a>');
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
    res.send('<h2>आपकी शिकायत सफलतापूर्वक दर्ज कर ली गई है। इसकी रिपोर्ट करने के लिए धन्यवाद।</h2><a href="https://saftefy-from-stray-dogs.vercel.app/contact-us">Home</a>'); // Replace with your actual success page
  } catch (error) {
    console.error('Error submitting complaint:', error);
    res.status(500).send('Something went wrong while submitting the complaint.');
  }
});


//contact-us form
app.post('/contact-us', async (req, res) => {
  let user = null;

  if (req.session?.user) {
    user = req.session.user;
  } else if (req.cookies?.user) {
    try {
      user = JSON.parse(req.cookies.user);
    } catch (err) {
      console.error('Invalid cookie:', err);
    }
  }

  const { city, state, age, joinus, 'g-recaptcha-response': token } = req.body;

  if (!user) {
    return res.render('test'); // or redirect if needed
  }

  if (!token) {
    return res.send('<h2>⚠️ reCAPTCHA token missing.</h2><a href="https://saftefy-from-stray-dogs.vercel.app/contact-us">Home</a>');
  }

  try {
    // Step 1: Verify reCAPTCHA
    const secretKey = '6LdCpz4rAAAAAD34Q_Dy2DbI7elrwnIcCfXWN6XU';
    const response = await axios.post(
      'https://www.google.com/recaptcha/api/siteverify',
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
      return res.send('<h2>⚠️ Captcha failed. Please try again or check for suspicious activity.</h2><a href="https://saftefy-from-stray-dogs.vercel.app/contact-us">Home</a>');
    }

    // Step 2: Append to Google Sheet
    const authClient = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: authClient });

    const values = [
      new Date().toLocaleString(), // Timestamp
      user.name,
      user.email,
      city,
      state,
      parseInt(age),
      joinus === 'on' ? 'Yes' : 'No',
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: '1iDtqmcPJb420V7CHodZC7gmMR12P5nxTQ_VUXp-Vk-4',
      range: 'Sheet1', // Replace with your sheet name
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [values],
      },
    });

    return res.render('joined', { user });
  } catch (err) {
    console.error('Error during contact-us form submission:', err);
    res.status(500).send('❌ Server error.');
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
      return res.send('<h2>आप पहले ही मतदान कर चुके हैं। केवल एक बार मतदान की अनुमति है।</h2><a href="https://saftefy-from-stray-dogs.vercel.app/contact-us">Home</a>');
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

    res.send('<h2>धन्यवाद! आपका मतदान सफलतापूर्वक सबमिट हो गया है।</h2><a href="https://saftefy-from-stray-dogs.vercel.app/contact-us">Home</a>');

  } catch (error) {
    console.error('Error submitting poll:', error);
    res.send('<h2>कुछ गलत हो गया। कृपया पुनः प्रयास करें।</h2>');
  }
});

//dashboard
app.get('/api/dashboard', async (req, res) => {
  let totalPolls = 0;
  let avgRating = 0;
  let q1Yes = 0;
  let q2Yes = 0;

  try {
    const authClient = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: authClient });

    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: '1YI0s9MprWcInk3Gol0w9Is5KCcYFTDRnGVNDPwwjRMw',
      range: 'poll_data',
    });

    const rows = result.data.values || [];
    totalPolls = rows.length;

    let totalRating = 0;
    rows.forEach(row => {
      const rating = parseFloat(row[3]) || 0;
      const q1 = row[4]?.trim();
      const q2 = row[5]?.trim();

      totalRating += rating;
      if (q1 === 'हाँ') q1Yes++;
      if (q2 === 'हाँ') q2Yes++;
    });

    avgRating = totalPolls > 0 ? (totalRating / totalPolls).toFixed(2) : 0;

  } catch (err) {
    console.error('Dashboard API error:', err.message);
  }

  res.json({
    totalPolls,
    avgRating,
    q1Yes,
    q2Yes
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
