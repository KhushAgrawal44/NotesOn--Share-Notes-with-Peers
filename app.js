require('dotenv').config();
const express=require("express");
const multer=require("multer");
const path=require("path");
const bodyparser=require("body-parser");
const ejs = require("ejs");
const _ = require("lodash");
const mongoose=require("mongoose");
const session = require('express-session');
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');


const app = express();
app.set('view engine', 'ejs');
app.use(bodyparser.urlencoded({extended: true}));
app.use(express.static("public"));

app.use(session({
  secret: "Our little secret.",
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());


var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './public/uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + '_' + Date.now() + path.extname(file.originalname))
  }
})

var upload = multer({
  storage: storage
}).single("note")

mongoose.connect("mongodb://localhost:27017/NotesONDB", {useNewUrlParser: true,useUnifiedTopology: true});
mongoose.set("useCreateIndex", true);

var videosSchema=new mongoose.Schema({
   category:String,
   type:String,
   title:String,
   sharelink:String,
   embedlink:String
});
var Video=mongoose.model("Video",videosSchema);

var notesSchema=new mongoose.Schema({
   notename:String,
   category:String,
   subject:String,
   title:String,
   subtitle:String,
   num:Number,
   description:String,
   notesource:String,
   sourcename:String,
   likes:Number
});
var Note=mongoose.model("Note",notesSchema);


const userSchema = new mongoose.Schema ({
  firstname:String,
  lastname:String,
  email: String,
  institute:String,
  course:String,
  currentyear:String,
  password: String,
  googleId: String,
  notes:[notesSchema],
  videos:[videosSchema],
});

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
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/browse",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile);

    User.findOrCreate({ googleId: profile.id,firstname:profile.name.givenName,lastname:profile.name.familyName }, function (err, user) {
      return cb(err, user);
    });
  }
));

let notes=[];

app.get("/",function(req , res){
  res.render("home");
})

app.get("/auth/google",
  passport.authenticate('google', { scope: ["profile"] })
);

app.get("/auth/google/browse",
  passport.authenticate('google', { failureRedirect: "/login" }),
  function(req, res) {
    // Successful authentication, redirect to secrets.
    res.redirect("/browse");
  });


app.get("/register",function(req,res){
  res.render("register");
})

app.post("/register", function(req, res){

if(req.body.password === req.body.conpass)
{
  User.register({
    username: req.body.username,
    firstname:req.body.fname,
    lastname:req.body.lname,
    }, req.body.password, function(err, user){
    if (err) {
      console.log(err);
      res.redirect("/register");
    } else {
      passport.authenticate("local")(req, res, function(){
        res.redirect("/browse");
      });
    }
  });
}
else
{
  res.redirect("/register");
}
});

app.get("/login", function(req, res){
  res.render("login");
});

app.post("/login", function(req, res){

  const user = new User({
    username: req.body.username,
    password: req.body.password
  });

  req.login(user, function(err){
    if (err) {
      console.log(err);
    } else {
      passport.authenticate("local")(req, res, function(){
        res.redirect("/browse");
      });
    }
  });
});

app.get("/dashboard",function(req,res){
  if (req.isAuthenticated()){
    res.render("dashboard",{notes:req.user.notes});
  } else {
    res.redirect("/login");
  }
})

app.get("/dash",function(req,res){
  User.findById(req.user.id,function(err,foundUser){
    res.render("dash",{alert:"",svideos:foundUser.videos})
  })
  //res.render("dash");
})

app.post("/delete",function(req,res){
  console.log("delete route called");
  console.log(req.body.button);
  User.findOneAndUpdate({_id: req.user.id}, {$pull: {videos: {_id: req.body.button}}}, function(err, foundUser){
  console.log(foundUser);
   if (!err){
     res.render("dash",{alert:"Video Deleted SUCCESSFULLY",svideos:foundUser.videos,});
    }
  });
})

app.get("/new_note",function(req,res){
  res.render("new_note");
})

app.post("/new_note",upload,function(req,res){
var notefile=req.file.filename;
var notecategory=req.body.category;
var notesubject=req.body.subject;
var notetitle=req.body.title;
var notesubtitle=req.body.subtitle;
var notechapt=req.body.num;
var notedescription=req.body.description;


User.findById(req.user.id ,function(err,foundUser){

  const note=new Note({
    notename:notefile,
    category:notecategory,
    subject:notesubject,
    title:notetitle,
    subtitle:notesubtitle,
    num:notechapt,
    description:notedescription,
    notesource:foundUser._id,
    sourcename:foundUser.firstname +" "+foundUser.lastname
  })
  foundUser.notes.push(note);
  note.save();
  foundUser.save();
 res.redirect("/dashboard");
})
})

app.get("/browse", function(req, res){
  if(req.isAuthenticated())
  {
    Note.find({}, function(err, foundnotes){
      if (err){
        console.log(err);
      } else {
        if (foundnotes) {
          res.render("browse", {title:"All Notes",notes: foundnotes});
        }
      }
    });
  }
});

app.post("/browse",function(req,res){
  Note.find({category:req.body.button},function(err,foundnotes){
    res.render("browse",{title:req.body.button,notes:foundnotes});
  })
})

app.get("/engineering", function(req, res){
  if(req.isAuthenticated())
  {
    Engineering.find({}, function(err, foundnotes){
      if (err){
        console.log(err);
      } else {
        if (foundnotes) {
          res.render("engineering", {notes: foundnotes});
        }
      }
    });
  }
});

app.get("/notes/:notesid", function(req, res){
const reqnote = req.params.notesid ;
Note.findOne({_id:reqnote},function(err,foundnote){

  if(foundnote)
  {
      res.render("note",{
        category:foundnote.category,
        subject:foundnote.subject,
        title:foundnote.title,
        subtitle:foundnote.subtitle,
        num:foundnote.num,
        price:foundnote.price,
        description:foundnote.description,
        notefile:foundnote.notename,
        id:foundnote._id
      });
  }
  else
  {
    console.log(err);
  }
})
})
app.get("/engineering/:notesid", function(req, res){
const reqnote = req.params.notesid ;

Engineering.findOne({_id:reqnote},function(err,foundnote){

  if(foundnote)
  {
      res.render("note",{
        category:foundnote.category,
        subject:foundnote.subject,
        title:foundnote.title,
        subtitle:foundnote.subtitle,
        num:foundnote.num,
        price:foundnote.price,
        description:foundnote.description,
        notefile:foundnote.notename,
        id:foundnote._id
      });
  }
  else
  {
    console.log(err);
  }
})
})
app.get("/users/:notesource",function(req,res){
  const requser = req.params.notesource ;

  User.findOne({_id:requser},function(err,foundUser){
    if(foundUser)
    {
      res.render("user-profile",
      {
        fname:foundUser.firstname,
        lname:foundUser.lastname,
        email:foundUser.username,
      });
    }
  })
})

app.get("/admin",function(req,res){
  res.render("admin");
})

app.get("/videos",function(req,res){
Video.find({},function(err,foundvideos){
  if(foundvideos)
  {
    res.render("videos",{title:"All Videos",videos:foundvideos})
  }
})
})

app.post("/videos",function(req,res){
  console.log(req.body.button);
  Video.find({category:req.body.button},function(err,foundvideos){
    res.render("videos",{title:req.body.button,videos:foundvideos});
  })
})

app.post("/admin",function(req,res){
  const type=req.body.type;
  const category=req.body.category;
  const title =req.body.title;
  const link=req.body.link;
  if(type==="singlevideo")
  {
     var key=link.slice(17);
     var fulllink=''.concat('https://www.youtube.com/embed/',key);
     const video = new Video({
       type:type,
       category:category,
       title:title,
       sharelink:link,
       embedlink:fulllink
     })
     video.save();
     res.redirect("/videos");
  }
  else if(type==="playlist")
  {
   key=link.slice(38);
   var fulllink=''.concat('https://www.youtube.com/embed/videoseries?list=',key);
   const video = new Video({
     type:type,
     category:category,
     title:title,
     sharelink:link,
     embedlink:fulllink
   })
   video.save();
   res.redirect("/videos");
  }
})

function myFunction(x) {
x.classList.toggle("fa-square");
}

app.post("/save",function(req,res){
  console.log(req.body.save);
  User.findById(req.user.id,function(err,foundUser){
    Video.findById({_id:req.body.save},function(err,foundVideo){
        if(foundUser.videos.length===0)
        {
          console.log("user has saved no video yet");
          const video = new Video({
              type:foundVideo.type,
              category:foundVideo.category,
              title:foundVideo.title,
              sharelink:foundVideo.sharelink,
              embedlink:foundVideo.embedlink,
            })

            foundUser.videos.push(video);
            foundUser.save();
            res.redirect("/dash");
        }
        else
        {
          console.log("user has saved some videos");  
              const video = new Video({
                  type:foundVideo.type,
                  category:foundVideo.category,
                  title:foundVideo.title,
                  sharelink:foundVideo.sharelink,
                  embedlink:foundVideo.embedlink,
                })
                foundUser.videos.push(video);
                foundUser.save();
                res.redirect("/dash");
        }
    })
  })
})

app.get("/profile",function(req,res){
  User.findById(req.user.id,function(err,foundUser){
    if(foundUser)
    {
      res.render("profile",
      {
        fname:foundUser.firstname,
        lname:foundUser.lastname,
        email:foundUser.username,
        institute:foundUser.institute,
        course:foundUser.course,
        cyear:foundUser.currentyear
      });
    }
  })
})

app.get("/logout", function(req, res){
  req.logout();
  res.redirect("/");
});

app.listen("3000",function(){
  console.log("server running on port 3000");
})
