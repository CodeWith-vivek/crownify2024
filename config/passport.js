const passport=require("passport")
const GoogleStrategy=require("passport-google-oauth20").Strategy
const User =require("../models/userSchema")
const env=require("dotenv").config()

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "https://crownify.vivekanand.tech/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Check if a user is already registered with this Google account
        let user = await User.findOne({ googleId: profile.id });

        // Check if a user exists with the same email
        const existingUser = await User.findOne({
          email: profile.emails[0].value,
        });

        if (existingUser && !existingUser.googleId) {
          // If an existing user is found with the same email but without Google ID
          return done(null, false, {
            message:
              "This email is already associated with a local account. Please log in with that account.",
          });
        }

        // If the user exists with Google ID, proceed
        if (user) {
          return done(null, user);
        } else {
          // Create a new user if none found
          user = new User({
            name: profile.displayName,
            email: profile.emails[0].value,
            googleId: profile.id,
          });
          await user.save();
          return done(null, user);
        }
      } catch (error) {
        console.error("Error during Google authentication:", error);
        return done(error, null);
      }
    }
  )
);
// passport.use(
//   new GoogleStrategy(
//     {
//       clientID: process.env.GOOGLE_CLIENT_ID,
//       clientSecret: process.env.GOOGLE_CLIENT_SECRET,
//       callbackURL: "https://crownify.vivekanand.tech/auth/google/callback",
//     },
//     async (accessToken, refreshToken, profile, done) => {
//       try {
//         // Check if a user is already registered with this Google account
//         let user = await User.findOne({ googleId: profile.id });

//         // Check if a user exists with the same email
//         const existingUser = await User.findOne({
//           email: profile.emails[0].value,
//         });

//         if (existingUser && !existingUser.googleId) {
//           // If an existing user is found with the same email but without Google ID
//           return done(null, false, {
//             message:
//               "This email is already associated with a local account. Please log in with that account.",
//           });
//         }

//         // If the user exists with Google ID, proceed
//         if (user) {
//           return done(null, user);
//         } else {
//           // Create a new user if none found
//           user = new User({
//             name: profile.displayName,
//             email: profile.emails[0].value,
//             googleId: profile.id,
//           });
//           await user.save();
//           return done(null, user);
//         }
//       } catch (error) {
//         console.error("Error during Google authentication:", error);
//         return done(error, null);
//       }
//     }
//   )
// );

// passport.use(
//   new GoogleStrategy(
//     {
//       clientID: process.env.GOOGLE_CLIENT_ID,
//       clientSecret: process.env.GOOGLE_CLIENT_SECRET,
//       callbackURL: "https://crownify.vivekanand.tech/auth/google/callback",
//     },
//     async (accessToken, refreshToken, profile, done) => {
//       try {
//         let user = await User.findOne({ googleId: profile.id });
//         if (user) {
//           return done(null, user);
//         } else {
//           user = new User({
//             name: profile.displayName,
//             email: profile.emails[0].value,
//             googleId: profile.id,
//           });
//           await user.save();
//           return done(null, user);
//         }
//       } catch (error) {
//         console.error("Error during Google authentication:", error);
//         return done(error, null);
//       }
//     }
//   )
// );

// passport.use(
//   new GoogleStrategy(
//     {
//       clientID: process.env.GOOGLE_CLIENT_ID,
//       clientSecret: process.env.GOOGLE_CLIENT_SECRET,
//       callbackURL: "https://crownify.vivekanand.tech/auth/google/callback",
//     },
//     async (accessToken, refreshToken, profile, done) => {
//       try {
//         // Check if user exists with this email
//         const existingUser = await User.findOne({
//           email: profile.emails[0].value,
//         });

//         if (existingUser) {
//           // If user exists and has googleId, allow login
//           if (existingUser.googleId) {
//             return done(null, existingUser);
//           }
//           // If user exists but no googleId (means they registered normally)
//           return done(null, false, {
//             message:
//               "User with this email already registered via normal signup.",
//           });
//         }

//         // If no existing user, create new user
//         const newUser = new User({
//           name: profile.displayName,
//           email: profile.emails[0].value,
//           googleId: profile.id,
//           isVerified: true,
//           avatar: profile.photos?.[0]?.value || null,
//         });

//         await newUser.save();
//         return done(null, newUser);
//       } catch (error) {
//         console.error("Error during Google authentication:", error);
//         return done(error, null);
//       }
//     }
//   )
// );


passport.serializeUser((user,done)=>{
    done(null,user.id)

})

passport.deserializeUser((id,done)=>{
    User.findById(id)
 .then(user=>{
    done(null,user)
 }).catch(err=>{
    done(err,null)
 })

})

module.exports=passport