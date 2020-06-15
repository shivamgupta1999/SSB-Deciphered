require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require('express-session');
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');

const app = express();

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(session({
  secret: "Our little secret.",
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb+srv://admin-Shivam@cluster0-akc0n.mongodb.net/ssbDB", {useNewUrlParser: true,useUnifiedTopology: true});
mongoose.set("useCreateIndex", true);

const userSchema = new mongoose.Schema ({
  username: String,
  fullName: String,
  googleId: String
});

const commentSchema = new mongoose.Schema ({
  body: String,
  authorid: String,
  author: String,
  date: String,
  replies: {type:[{author: String, date: String, content:String, parentId:String}], index:true}
});

const Comment = new mongoose.model("Comment", commentSchema);

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

passport.use(new GoogleStrategy({
    clientID: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    callbackURL: "https://ssbdeciphered.herokuapp.com/auth/google/discussions",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ googleId: profile.id, username: profile.displayName, fullName: profile.displayName }, function (err, user) {
      return cb(err, user);
    });
  }
));

app.get("/auth/google",
  passport.authenticate('google', { scope: ["profile"] })
);

app.get("/auth/google/discussions",
  passport.authenticate('google', { failureRedirect: "/home" }),
  function(req, res) {
    res.redirect("/discussions");
  });

app.get("/discussions", function(req, res){
  if(req.isAuthenticated()){
    Comment.find({}, function(err, foundComments){
      if (err){
        console.log(err);
      } else {
        if (foundComments) {
          res.render("discussions",{comments:foundComments,userId:req.user.googleId});
        }
      }
    });
  }
});

app.post("/discussions", function(req, res){
  var today = new Date();
  var createdDate = today.toDateString();
  const comment = new Comment({
    body: req.body.comment,
    author: req.user.fullName,
    authorid: req.user.googleId,
    date: createdDate
  });
  comment.save();
  res.redirect("/discussions");
});

app.post("/discussions/:commentId", function(req, res){
  var today = new Date();
  var createdDate = today.toDateString();
  const requestedCommentId = req.params.commentId;
  const rep=req.body.reply;
        Comment.findOneAndUpdate({_id: requestedCommentId}, {$push: {replies:{content: rep,date: createdDate,author:req.user.fullName, parentId: req.user.googleId}}}).exec();
          res.redirect("/discussions");
});

app.get("/logout", function(req, res){
  req.logout();
  res.redirect("/");
});

app.post("/comment/:action", function(req, res){
        if (req.param('action') === 'delete') {
          Comment.deleteOne({ _id: req.body.name }, function(err) {
            if (!err) {
                    res.redirect("/discussions");
            }
        });
          }

});

app.post("/reply/delete", function(req, res){
  Comment.findOneAndUpdate({_id: req.body.name}, {$pull: {replies:{_id:req.body.name2}}}).exec();
    res.redirect("/discussions");
});

app.get("/", function(req, res){
  res.render("home");
});


app.listen(process.env.PORT || 3000, function() {
  console.log("Server started successfully");
});
