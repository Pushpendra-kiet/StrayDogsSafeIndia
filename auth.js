const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const USER = {}; // You can later save users in MongoDB

passport.use(new GoogleStrategy({
  clientID: process.env.AUTH_CLIENT_ID,
  clientSecret: process.env.AUTH_CLIENT_SECRET,
  callbackURL: 'https://saftefy-from-stray-dogs.vercel.app/auth/google/callback',
},
function(accessToken, refreshToken, profile, done) {
  // Simulate storing user in DB
  USER.googleId = profile.id;
  USER.name = profile.displayName;
  USER.email = profile.emails[0].value;
  return done(null, USER);
}));

passport.serializeUser((user, done) => {
  done(null, user.googleId);
});

passport.deserializeUser((id, done) => {
  done(null, USER); // Should fetch user from DB by id
});
