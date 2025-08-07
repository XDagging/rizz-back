// const express = require('express');
// const router = express.Router();
import { rateLimit } from 'express-rate-limit'
import { locateEntry, updateEntry } from "./databaseFunctions";
import express from "express";
const {authenticateUser, isEmail, isPassword, isString, isNumber, reportError, craftRequest, setCookie, sendEmail, generateCode} = require('./functions.js');
import type { User } from "./types";
import { UpdateKinesisStreamingDestinationCommand } from "@aws-sdk/client-dynamodb";
// import { authenticate } from "passport";
import type { Test } from "./types"
import { gradeTest } from "./testWorkflow";
import { generateResponse } from "./testWorkflow"

export const testRouter = express.Router();
const limiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	limit: 200, // Limit each IP to 100 requests per `window` (here, per 15 minutes).
	standardHeaders: 'draft-8', // draft-6: `RateLimit-*` headers; draft-7 & draft-8: combined `RateLimit` header
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
	ipv6Subnet: 56, // Set to 60 or 64 to be less aggressive, or 52 or 48 to be more aggressive
})

testRouter.use(limiter)



testRouter.get("/", async (req,res) => {
    console.log("get test was called via router")
    authenticateUser(req).then(async(user: "No user found" | User) => {
        if (user==="No user found") {
            res.status(400).send(craftRequest(400));
        } else {


            console.log('amount of tests available', user.testsAvailable<=0)
            if (user.testsAvailable>0) {
                console.log("inside tests avialable if")
                const testsList: any = await locateEntry("uuid", "ALL_TESTS")

                

                const allAvailableTests = testsList.testList;
             
                const takenTestUuids = new Set(user.allTests);

                const availableNotTakenTests = allAvailableTests.filter(
                    (test: Test) => !takenTestUuids.has(test.uuid)
                );


                if (availableNotTakenTests.length>0) {
                    console.log(availableNotTakenTests)
                    const indexChosen = Math.floor(Math.random()*availableNotTakenTests.length)
                    console.log("i chose this index", indexChosen)
                    const chosenTest = availableNotTakenTests[indexChosen]

                    console.log("chosenTest", chosenTest)
                    const test = await locateEntry("uuid", chosenTest)

                    updateEntry("uuid", user.uuid,
                        {
                            testsAvailable: user.testsAvailable-1
                        }
                    )

                    res.status(200).send(craftRequest(200, {uuid: chosenTest, test: test}))

                } else {
                    res.status(400).send(craftRequest(400, "come back later"))
                }
                
               
                


                
                // const test = await generateTest()



            } else {
                res.status(400).send(craftRequest(400, "out of available tests"))
            }
            





        }
    })
})

testRouter.post("/aiResponse", async(req,res) => {

    const {testId, questionNumber, messages} = req.body;

    authenticateUser(req).then(async(user) => {
        if (user === "No user found") {
            res.status(400).send(craftRequest(400))
        } else {

            console.log("testid", testId);
            console.log("questionNumber", typeof questionNumber === "number");
            console.log("Array", Array.isArray(messages))
            if (testId&&typeof questionNumber === "number"&&Array.isArray(messages)) {

                // It's a valid request then


                const test: any = await locateEntry("uuid", testId);
                if (test!=="") {
                        console.log("we r here")
                const allQuestions = test.fullTest;

                const questionAsked = allQuestions["slideIntoDmsQuestions"][questionNumber];


                const response = await generateResponse(messages, questionAsked.prompt,questionAsked.question, questionAsked.goal);

                res.status(200).send(craftRequest(200, response));

                } else {
                    res.status(400).send(craftRequest(400));
                }
            



                



            } else {
                console.log("we failed the initial")
                res.status(400).send(craftRequest(400));
            }







        }
    })



})



testRouter.post("/voiceResponse", async(req,res) => {
    try {

          const {testId, messages} = req.body;;

        console.log("this was the testId", typeof testId === 'string')
        console.log("this were the messages", Array.isArray(messages))
        authenticateUser(req).then(async(user) => {
            if (user==="No user found") {
                res.status(403).send(craftRequest(403))
            } else {

                if (typeof testId === "string" && Array.isArray(messages)) {
                     const test: any = await locateEntry("uuid", testId);
                    if (test!=="") {
                        console.log("we r here")
                        const allQuestions = test.fullTest;
                        const questionAsked = allQuestions["realTimeLiveQuestion"];
                        const response = await generateResponse(messages, questionAsked.prompt, questionAsked.question, questionAsked.goal )
                        
                        res.status(200).send(craftRequest(200, response));


                    }


         } else {

            console.log("Invalid testId or messages");

        }

               
        }
    })
      



    } catch(e){




        console.log("This is an error:", e)

        res.status(400).send(craftRequest(400));
    }



})


testRouter.post("/submitTest", (req,res) => {
    try {
        authenticateUser(req).then(async(user) => {
            if (user === "No user found") {
                res.status(400).send(craftRequest(400))
            } else {
                const {testId, mcqAnswers, dmsAnswers,liveAnswers} = req.body;
                console.log(req.body)
                const test : any = await locateEntry("uuid", testId);
                

                const score = await gradeTest(testId, mcqAnswers, dmsAnswers, liveAnswers, test)

                console.log("this is the user saved", user)
                await updateEntry("uuid", user.uuid,
                    {
                        timesTaken: user.timesTaken+1,
                        highestScore: score.charm+score.execution > user.highestScore ? Number(score.charm+score.execution) : user.highestScore,
                        allTests: user.allTests ? [...user.allTests, {...score, date: Date.now()}] : [{...score, date: Date.now()}]
                    }
                    
                );

                res.status(200).send(craftRequest(200));



            
            
            
            
            }
        })

        






    } catch(e) {

        console.log(e)
        res.status(400).send(craftRequest(400));
    
    
    }
})
