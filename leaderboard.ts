import { addEntry, locateEntry, updateEntry } from "./databaseFunctions";
import express from "express";
const {authenticateUser, isEmail, isPassword, isString, isNumber, reportError, craftRequest, setCookie, sendEmail, generateCode} = require('./functions.js');
    // import type { User } from "./types";
    import { UpdateKinesisStreamingDestinationCommand } from "@aws-sdk/client-dynamodb";
// import { authenticate } from "passport";
import type { LeaderboardList, LeaderboardPlayer, Test, User } from "./types"
import { gradeTest } from "./testWorkflow";
import { generateResponse } from "./testWorkflow"
import {cmod} from "./app"
export const leaderboard = express.Router();



export function checkIfLeaderboard(score: number, user: User): Promise<boolean> {
    return new Promise(async(resolve) => {
        try {
            const leaderboardLength = 5;

            const prevLeaderboard: any = await locateEntry("uuid", "LEADERBOARD");

            if (!prevLeaderboard) {
                const leaderboard = Array(leaderboardLength).fill({
                    uuid: "noOne",
                    name: "",
                    score: 0,
                });

                leaderboard[0] = {
                            uuid: user.uuid,
                            name: cmod.decrypt(user.name).toLowerCase().trim(),
                            score: score
                }
                    // low indexes -> higher place, high indexes -> lower place
                addEntry({
                    uuid: "LEADERBOARD",
                    list: leaderboard
                })
                resolve(true);

            } else {
                const list = prevLeaderboard as LeaderboardList;
                if (score<list.list[list.list.length-1].score) {
                    resolve(false);
                }

                for (let i=0; i<list.list.length; i++) {    
                        list[i] = {
                            name: cmod.decrypt(user.name),
                            uuid: user.uuid,
                            score: score
                        }
                        updateEntry("uuid", "LEADERBOARD", {
                            list: list
                        })
                        break;
                    }
                }
                resolve(true);
        } catch(e) {
            console.log(e);
            resolve(false);
        }


    })





}

// This route hasn't been tested yet
leaderboard.get("/", (req,res) => {
    try {


        locateEntry("uuid", "LEADERBOARD").then((leaderboard: any) => {
            if (leaderboard!=="") {
                const list: LeaderboardList = leaderboard
                
                res.status(200).send(craftRequest(200, list.list.map((place: LeaderboardPlayer) => {
                    if (place.name!=="") {
                        return {
                            name: cmod.decrypt(place.name),
                            score: place.score
                        }
                    } else {
                        return {
                            name: "This could be you...",
                            score: 0,
                        }
                    }
                })))


                
            } else {
                res.status(400).send(craftRequest(400));
            }


        })





    } catch(e) {
        console.log(e);
        res.status(400).send(craftRequest(400));
    }


})

// Check if it's worth changing and allat, handles changes as well


// Leaderboard will be top 5


// Code hasn't been tested yet.

