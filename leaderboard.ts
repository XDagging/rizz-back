import { addEntry, locateEntry, updateEntry } from "./databaseFunctions";
import express from "express";
const {authenticateUser, isEmail, isPassword, isString, isNumber, reportError, craftRequest, setCookie, sendEmail, generateCode} = require('./functions.js');
// import type { User } from "./types";
import { UpdateKinesisStreamingDestinationCommand } from "@aws-sdk/client-dynamodb";
// import { authenticate } from "passport";
import type { LeaderboardList, Test, User } from "./types"
import { gradeTest } from "./testWorkflow";
import { generateResponse } from "./testWorkflow"
import {cmod} from "./app"
export const leaderboard = express.Router();




leaderboard.get("/", (req,res) => {
    try {





    } catch(e) {
        console.log(e);
        res.status(400).send(craftRequest(400));
    }


})

// Check if it's worth changing and allat, handles changes as well


// Leaderboard will be top 5
export function checkIfLeaderboard(score: number, user: User): Promise<boolean> {
    return new Promise(async(resolve) => {
        try {


            const prevLeaderboard: any = await locateEntry("uuid", "LEADERBOARD");

            if (!prevLeaderboard) {
                const newLeaderboard =  [
                        {
                            uuid: user.uuid,
                            name: cmod.decrypt(user.name).toLowerCase().trim(),
                            score: score
                        }
                    ]
                    // low indexes -> higher place, high indexes -> lower place
                  
                
                addEntry({
                    uuid: "LEADERBOARD",
                    list: newLeaderboard
                })
                resolve;

            } else {


                const list = prevLeaderboard as LeaderboardList;

                for (let i=list.list.length-1; i>=0; i--) {
                    if (score>list.list[list.list.length-1].score) {
                        resolve(false);
                    } else {
                        if (i!==list.list.length-1) {
                            list[i] = {
                                name: cmod.decrypt(user.name),
                                uuid: user.uuid,
                                score: score
                            }
                            updateEntry("uuid", "LEADERBOARD", {
                                list: list
                            })
                        }
                    }

                }

             


            }


            




        } catch(e) {


            console.log(e);
            resolve(false);


        }


    })





}