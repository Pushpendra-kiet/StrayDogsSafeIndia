const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('./models/User');

passport.use(new GoogleStrategy({
  clientID: '1067075470360-ujqa07afqodhi7sdbnv5he6303vjr4g2.apps.googleusercontent.com',
  clientSecret: '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',
  callbackURL: 'https://stray-dogs-safe-india.vercel.app/auth/google/callback'
},
async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await User.findOne({ googleId: profile.id });

    if (!user) {
      user = await User.create({
        googleId: profile.id,
        name: profile.displayName,
        email: profile.emails[0].value
      });
    }

    return done(null, user);
  } catch (err) {
    return done(err, null);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});
