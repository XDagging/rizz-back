require('dotenv').config()
// npm i express https cors fs body-parser express-session uuid memorystore @aws-sdk/lib-dynamodb @aws-sdk/client-dynamodb md5 cryptr

const {authenticateUser, isEmail, isPassword, isString, isNumber, reportError, craftRequest, setCookie, sendEmail, generateCode} = require('./functions.js');

import express, {Router} from "express";
// const express = require("express");
// const https = require("https");
import https from "https";
import startWebsocket from "./connections.js";
import cors from "cors"
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as LocalStrategy } from "passport-local"
import { v4 } from "uuid";


import fs from "fs"
import { Request, Response, NextFunction } from 'express';
// const md5 = require('md5');
import md5 from "md5"
import http from "http";
import bodyParser from "body-parser"
// const bodyParser = require("body-parser")
const app = express();
const region: string = "us-east-1"
// const session = require("express-session");
// @ts-ignore
import session from "express-session"

import {locateEntry, addEntry, updateEntry} from "./databaseFunctions.js"
// ...existing code...
// Use require for memorystore if import fails

const MemoryStore = require("memorystore")(session);
// ...existing code...

// const bcrypt = require("bcrypt");
import bcrypt from "bcrypt"

// const Cryptr = require('cryptr');
import Cryptr from "cryptr"
import { testRouter } from "./test";
const saltRounds = 10;
import type { Options, RegisterBody, User, LoginBody, CodeBody, LocateEntryEntry, BrowserUser } from "./types.js";
if (!process.env.ENCRYPTION_KEY) {
    throw new Error("Encryption key isn't set. Add it now.");
}
const cmod = new Cryptr(process.env.ENCRYPTION_KEY);

// Things to do

const SCHEMA = ['name','email','password', ]

// Basic web server configurations
let options: Options;
export const sessionMiddleware = session({
    secret: process.env.COOKIE_SECRET as string,
    cookie: {
        path: "/",
        maxAge: 2628000000,
        httpOnly: true,     
        sameSite: "none",
        secure: true,
    },
    resave: false,
    saveUninitialized: true,
    store: new MemoryStore({
        checkPeriod: 86400000 
    }) as any, 
})
app.use(sessionMiddleware)

app.use(passport.initialize());
app.use(passport.session());

if (process.env.NODE_ENV === "DEV") {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

    // development certificate
    options = {
        key: fs.readFileSync('C:\\Users\\marac\\code\\hackathon-quhacks\\key.pem'),
        cert: fs.readFileSync('C:\\Users\\marac\\code\\hackathon-quhacks\\cert.pem'),
        // Remove this line once done with production
        rejectUnauthorized: false
    };    
    // Local host
    app.use(cors({
        origin: "http://localhost:5173",
        methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
        credentials: true
    }));
    
} else {

    // STEP 1: This will be where the certificates are stored.

    options = {
        key: fs.readFileSync('C:\\Program Files\\Git\\usr\\bin\\key.pem'),
        cert: fs.readFileSync('C:\\Program Files\\Git\\usr\\bin\\certificate.pem'),
        // Remove this line once done with production
        rejectUnauthorized: false
    };    

    app.use(cors({
        origin: process.env.PROD_URL,
        methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
        credentials: true
    }));
    // prod credentials


}



passport.serializeUser((user: any, done) => {
    console.log("this is serial", user.uuid)
    done(null, user.uuid); // Save UUID in session
});

passport.deserializeUser(async (uuid: string, done) => {
    console.log("this is being called")
  try {
    console.log("Deserializing user with uuid:", uuid);
    const user = await locateEntry("uuid", uuid);
    console.log("deserialize", user);
    if (user!=="") {
      console.log("User found in DB:", user);
      done(null, user);
    } else {
        
      console.log("User not found or empty array", user);
      done(null, false);
    }
  } catch (err) {
    console.log("Error in deserialization:", err);
    done(err);
  }
});


passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID || "",
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  callbackURL: process.env.NODE_ENV?.toLowerCase() !== "dev"
    ? `${process.env.PROD_URL}/auth/google/callback`
    : "https://localhost:443/auth/google/callback"
},
async (accessToken, refreshToken, profile, cb) => {
  try {
    const email = profile.emails?.[0]?.value || "";
    const name = profile.displayName || "";
    const profilePic = profile.photos?.[0]?.value || "";
    
    console.log("em", email)
    console.log('name', name);
    console.log(profilePic)

    const user = await locateEntry("uuid", profile.id);
    console.log("User right now", user)
    if (user==="") {
      const u = await addEntry({
        uuid: profile.id,
        name: cmod.encrypt(name.toLowerCase().trim()),
        email: cmod.encrypt(email),
        emailHash: md5(email),
        timesTaken: 0,
        highestScore: 3,
        imgUrl: profilePic,
        testsAvailable: 3,
        allTests: [],
        password: "",

        // profilePic
      });
       return cb(null, u);
    }
    if (!Array.isArray(user)) {
        console.log("this is the user being passed", user)
        return cb(null, user);
    } else {
        console.log("the user is an array")
        cb("For some reason user is an array here.")
    }
    
  } catch (err) {
    return cb(err);
  }
}));


passport.use(new LocalStrategy( { usernameField: "email" },async(email, password, done) => {
    console.log("this was triggered chat")
    if (email&&password) {

        const users = await locateEntry("emailHash", md5(email.toLowerCase()));
        console.log("users in local strategy", users);
        if (Array.isArray(users) && users.length > 0) {
            const user = users[0]
            
            bcrypt.compare(password, user.password, (err: any,result: boolean) => {
                if (err) {
                    console.log(err);
                    done(err);
                    // res.status(400).send(craftRequest(400));
                } else {

                    console.log("this was the result", result)      
                    if (result) {
                        done(null, user)
                        // setCookie(req, user.uuid);
                        // res.status(200).send(craftRequest(200));
                    } else {
                        done(null, false);
                        // res.status(400).send(craftRequest(400));
                    }


                                }
                            })


            
        } else {
            console.log('we faileed this')
            done(null, false);
        }


    } else {
        done(null, false)
    }




}))



// Setting up cookies

// Setting up body parser
app.use(bodyParser.json({limit: "10mb"}))


const server = https.createServer(options, app);
// const server = http.createServer(app)
startWebsocket(server);



app.use("/getTest", testRouter)


// app.get("")


app.get("/", (req: Request,res: Response) => {
    res.send("new year new me")
})


app.get("/auth/google", passport.authenticate("google", {
    scope: ["profile", "email"],
    session: true
}))

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    // Successful auth
     const redirectUrl = process.env.NODE_ENV?.toLowerCase() === "dev" ? "http://localhost:5173" : process.env.PROD_URL 

    //     if (req.user) {
    //     req.logIn(req.user, (e) => {
    //         console.log("we are manually logging in", req.user)
    //         if (e) {
    //             console.error(e);
    //             res.redirect(redirectUrl + "/login")
    //         } else {
    //             console.log("Finally completed it correctly", req.user)
    //             res.redirect(redirectUrl + "/dashboard")
    //         }   
    //     })
    // }
    

   
    res.redirect(redirectUrl + "/dashboard");
  }
);


app.post('/register', async (req: Request,res: Response) => {
    // These are where the checks are. 


    // You need to add a variable name for every single thing you are trying to do.
    try {
        console.log("asdf");
        const {email, password, name} : RegisterBody = req.body;

        // console.log("name", name);
        console.log("email", email);
        console.log("password", password);

        if (password && email && name) {


            if (isEmail(email) && isPassword(password)) {
                console.log("made it thru here")
                // then we should check if the user exists or not
                
                await locateEntry("emailHash", md5(email.toLowerCase())).then((users: "" | User | User[]) => {
                    console.log("this is users", users)
                    if (Array.isArray(users) && users.length > 0) {
                        console.log("made it thru here 1")
                        // This would only occur when this user already exists
                        res.status(307).send(craftRequest(307))
                    } else {
                        const user = Array.isArray(users) ? users[0] : users;

                        if (user) {
                            console.log("made it thru here 2")
                            res.status(307).send(craftRequest(307));
                        } else {
                            let newUser = {};
                            const allKeys = Object.keys(req.body);
                            allKeys.forEach((key) => {

                                if (SCHEMA.includes(key)) {
                                    if (key.toLowerCase() !== "password") {
                                        newUser = {[key]: cmod?.encrypt(req.body[key].trim().toLowerCase())}
                                    }
                                }
                            })
                            console.log("made it thru here 3")
                            const uuid = v4();
                            // We should encrypt the password here
                            // We should maybe add some type safety here
                            bcrypt.hash(password, saltRounds, async(err,hash) => {

                                if (err) {
                                    reportError(err);
                                    console.log(err)
                                    res.status(404).send(craftRequest(404));

                                } else {
                                    const newUser = { 
                                        uuid: uuid,
                                        name: cmod.encrypt(name.trim().toLowerCase()),
                                        emailHash: md5(email.trim()),
                                        email: cmod?.encrypt(email.trim()),
                                        password: hash,
                                        timesTaken: 0,
                                        highestScore: 0,
                                        testsAvailable: 3,
                                        imgUrl: "imgUrl",
                                        allTests: [],
                                    }

                              
                                    await addEntry(newUser)
                                    req.logIn(newUser, (e) => {
                                        if (e) {
                                            console.log(e);
                                            res.status(400).send(craftRequest(400))
                                        } else {
                                            res.status(200).send(craftRequest(200,uuid));
                                        }
                                    })



                                    // setCookie(req,uuid);
                                    
                                }

                            })
                            // addEntry(newUser);
                        }
                    }
                })
    
    
    
            } else {
                res.status(400).send(craftRequest(400));
            }

        } else {
            res.status(400).send(await craftRequest(400));
        }
    } catch(e) {
        console.log(e);
    }
})




app.get("/logout", (req,res) => {


    req.logOut((e) => {
        if (e) {
            console.log(e);
            res.status(400).send(craftRequest(400));    
        } else {
            res.status(200).send(craftRequest(200));
        }
    })


})


app.post("/login", (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    console.log("this was err", err);
    console.log("this was user", user)
    console.log("this is info", info)
    if (err) {
      console.error(err);
      return res.status(500).send(craftRequest(500)); // Server error
    }

    if (!user) {
      // info.message can come from done(null, false, { message: 'Invalid password' })
      return res.status(400).send(craftRequest(400));
    }

    // Manually log the user in
    req.logIn(user, (err) => {
      if (err) {
        return res.status(500).send(craftRequest(500));
      }
      
      setCookie(req, user.uuid);
      return res.status(200).send(craftRequest(200, req.user));
    });
  })(req, res, next);
});

app.get("/isLoggedIn", (req,res) => {
    // const isAuthed = req.isAuthenticated()
      res.json({
    session: req.session,
    user: req.user,
    isAuth: req.isAuthenticated(),
  });
})

// app.post("/login", (req,res) => {

//     try {

//         const {email, password}: LoginBody = req.body;


//         if (isEmail(email) && isPassword(password)) {
//             locateEntry("emailHash", md5(email)).then((users: LocateEntryEntry) => {
//                 if (Array.isArray(users) && users.length > 0) {
//                     console.log(users[0])
//                     locateEntry("uuid", users[0].uuid).then((user: LocateEntryEntry) => {
//                         // console.log(thing);
//                         if (user != null&&user!=""&&!Array.isArray(user)) {
                            


//                             bcrypt.compare(password, user.password, (err: any,result: boolean) => {
//                                 if (err) {
//                                     console.log(err);
//                                     res.status(400).send(craftRequest(400));
//                                 } else {

                                    
//                                     if (result) {
//                                         setCookie(req, user.uuid);
//                                         res.status(200).send(craftRequest(200));
//                                     } else {
//                                         res.status(400).send(craftRequest(400));
//                                     }


//                                 }
//                             })

//                         } else {
//                             res.status(400).send(craftRequest(400));
//                         }
//                     })
//                 } else {
//                     res.status(400).send(craftRequest(400));
//                 }
//             })
//         } else {
//             res.status(403).send(craftRequest(403));
//         }



//     } catch(e) {

//         reportError(e);
//         res.status(400).send(craftRequest(400));
//     }



// }) 

app.get("/getUser", (req,res) => {
    console.log("Beginning of the getUser route")
    console.log({
    session: req.session,
    user: req.user,
    isAuth: req.isAuthenticated(),
  });
    console.log("req sessionId", req.sessionID)


    
    authenticateUser(req).then((user: User | "No user found") => {
        if (user === "No user found") {
            res.status(403).send(craftRequest(403));
        } else {
                const availableUser : BrowserUser = {
                        uuid: user.uuid,
                        name: cmod.decrypt(user.name),
                        email: cmod.decrypt(user.email),
                        highestScore: user.highestScore,
                        timesTaken: user.timesTaken,
                        testsAvailable: user.testsAvailable,
                        allTests: user.allTests,
                        imgUrl: user.imgUrl
                }
                // 
                res.status(200).send(craftRequest(200,availableUser))
                // console.error(users);

                // if (users.length>0) {
                //     const user = users[0];

                //     console.log(user);
                //     res.status(200).send(craftRequest(200,user));

                // } else {
                //     console.log("log",users)
                //     res.status(200).send(craftRequest(200,user))
                // }
            


        }
    })


})

app.post("/changeSettings", (req,res) => {

    try {

        // const {...x} = req.body;
        // console.log("req",req.body);
        authenticateUser(req).then((id: string) => {

            if (id === "No user found") {
    
                res.status(403).send(craftRequest(403))
            } else {
                
                locateEntry("uuid", id).then((user: LocateEntryEntry) => {
                    if (user !== ""&&!Array.isArray(user)) {
                        

                        const changedUser: any = {}
                        console.log(Object.keys(user))

                        Object.keys(user).map((key) => {
                            console.log("ajdsf", key)
                            if ((key !== "email") && (key !== "emailHash") && (key !== "password")) {
                                if (Object.keys(req.body).includes(key.toLowerCase())) {
                                    changedUser[key] = req.body[key];
                                }
                            }
                        })  


                        console.log("changed user", changedUser)
                        updateEntry("uuid", user?.uuid, changedUser).then((a) => {
                            console.log("a", a);
                            res.status(200).send(craftRequest(200));
                        })
                        return;
                        // do something here
                    } else {
                        res.status(400).send(craftRequest(400));
                    }
    
                    
                })
    
    
    
    
    
            }
    
    
    
        })


    } catch(e) {


        console.log(e)
        reportError(e);
        res.status(400).send(craftRequest(400));
        return;

    }
   


})



// This won't work
app.post("/sendCode", (req,res) => {
    try {

        const {email}: CodeBody = req.body;
        

        if (isEmail(email)) {
            locateEntry("emailHash", md5(email.trim())).then((users: LocateEntryEntry) => {
                // console.log("this is the",user)
                if (users !== ""&&Array.isArray(users)) {
                    // console.log(user);
                    const user = users[0]
                    const code = generateCode(6)

                    const text = `Hello,

You have asked to reset your password. If this wasn't you, ignore this email.

Your code is: ${code}`

                    // bookmark
                    console.log(user)
                    updateEntry("uuid", user.uuid, {passwordCode: code}).then((response: boolean) => {
                        if (response) {
                            sendEmail(email.trim(), `Reset Password - ${process.env.COMPANY_NAME}`,text).then((alert: boolean) => {
                                if (alert) {
                                    res.status(200).send(craftRequest(200));
                                } else {
                                    res.status(400).send(craftRequest(400));
                                }
                            
                            })
                        } else {
                            res.status(400).send(craftRequest(400));
                        }
                    })
                    


                } else {
                    res.status(400).send(craftRequest(400));
                }
            })


        } else {
            res.status(400).send(craftRequest(400));
        }




    } catch(e) {
        console.log(e);
        reportError(e);
        res.status(400).send(craftRequest(400));
    }
})




app.post("/changePassword", (req,res) => {
    try {
        const {code, password, email} = req.body;

        console.log(isPassword(password))
        console.log(isNumber(code))

        if (isPassword(password) && isNumber(code)) {


            const emailHash = md5(email);

            

            locateEntry("emailHash", emailHash).then((users: LocateEntryEntry) => {
                if (Array.isArray(users)&&users.length>0) {
                    const user = users[0];

                    locateEntry("uuid", user.uuid).then((user: LocateEntryEntry) => {
                        if (!Array.isArray(user)&&user !== "") {

                            if (String(user.passwordCode) === String(code)) {


                                if (isPassword(password)) {
                                    
                                    
                                    bcrypt.hash(password, saltRounds, function(err: any, hash: string) {
                                    // Store hash in your password DB.

                                        if (err) {
                                            reportError(err);
                                            res.status(400).send(craftRequest(400))
                                            
                                        } else {
                                            
                                            updateEntry("uuid",user.uuid,{password: hash}).then((x) => {
                                                res.status(200).send(craftRequest(200));
                                            })
                                        }
                                    });
                                    


                                } else {
                                    res.status(400).send(craftRequest(400, {status: "invalid password"}))
                                }



                            


                            } else {
                                res.status(400).send(craftRequest(400, {status: "invalid code"}))
                            }

                        } else {

                            res.status(400).send(craftRequest(400));


                        }

                    })




                } else {



                    res.status(403).send(craftRequest(403));
                }
            })

            





        } else {
            console.log(code);
            console.log(password);
            console.log(email);
            res.status(400).send(craftRequest(400));
        }

    } catch(e) {
        console.log(e);
        reportError(e);
        res.status(400).send(craftRequest(400));
    }
})













server.listen(process.env.PORT, () => {
    console.log("Listening on port:", process.env.PORT)
})






