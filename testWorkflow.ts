import 'dotenv/config'
import { z } from "zod"

// import { RunnableMapLike } from "langchain_core/runnables";
// import type { AnnotationBasedAgent } from "langgraph/agents";
import { BufferMemory } from "langchain/memory";
import { MessageType } from './types';
// import { Redis } from "ioredis";
// import { RedisByteStore } from "@ "ES2021.String"langchain/community/storage/ioredis";
import { StateGraph, MessagesAnnotation, addMessages } from "@langchain/langgraph";
import fs from "fs/promises"
import { ToolNode } from '@langchain/langgraph/prebuilt';
// import f from "fs";
import { v4 } from "uuid";
import type { Test, TestList } from './types';
import { ChatOpenAI } from "@langchain/openai";
import { addEntry, updateEntry } from './databaseFunctions';
import { AgentExecutor } from "langchain/agents";
import { AIMessage, BaseMessage } from '@langchain/core/messages';
import { locateEntry } from './databaseFunctions';
import { MemorySaver } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { createSupervisor } from "@langchain/langgraph-supervisor";
import path, { parse } from "path"
import { BaseCallbackHandler } from "@langchain/core/callbacks/base";
// import type { NewWorkFlow, CommandResponse } from "./server"
import { response } from 'express'
import { Hmac } from 'crypto';


 const llm = new ChatOpenAI({
            temperature: 0,
            model: "gpt-4o-mini",
       
    });


export async function generateTest() {
    return new Promise(async(resolve) => {


    const initialTest = async(state: any) => {
        const prompt = `you are an expert prompt engineer.  im creating a standardized test, much like the SAT. This test is meant to see how good someone's charmisma/rizz is. this standardized test is scored from 400-1600 and has two things that are being evaluated: Charm and execution. the maximum per type is 800 meaning that they aced the test and a 200 meaning that they got every question wrong. you are creating a test with the following format
20 mcq questions
3 "slide into dms" simulations
1 "real time live" simulation

each mcq question should be the following: 

{
    question: string,
    optionA: string,
    optionB: string,
    optionC: string,
    optionD: string,
    answer: correspondingletter
}

the correct answer should be random, it shouldn't the same option every single time. 

each "slide into dms" question should have the following format: 


{

    prompt: "describe how the girl should act in vivid detail"
    question: "the situation/scenario in which this is happening",
    goal: "some goal that the user should try to achieve in the conversation",
}


each "real time live" question should be in the following format: 

{
    prompt: "describe how the girl should act in vivid detail. give the girl's backstory, their experiences, and provide the question field to an extent. This prompt should explain the current situation for this interaction. "
    question: "the situation/scenario in which this is happening",
    goal: "some goal that the user should try to achieve in the conversation",
}

For the prompt, i want you to describe the personality as a person that would be difficult to rizz. It shouldn't be an easy test at all.

return things an object with lists like the following:


{

    mcqQuestions: [{},{}...],
    slideIntoDmsQuestions: [{},{}...],
    realTimeLiveQuestion: {},
}`
        console.log("Right before initialTest here")

    const response = state?.messages?.length>0 ? await llm.invoke([...state.messages, new HumanMessage(prompt)]) : await llm.invoke([new HumanMessage(prompt)]);
    console.log("intial test returned this", String(response.content))

    return {
        messages: state?.messages?.length>0 ? [...state.messages, new AIMessage(String(response.content))] : [new AIMessage(String(response.content))]
    }


    


    }

    const superviseTest = async(state) => {

        const prompt = `You are a validation agent for a standardized test designed to measure a person's charisma and execution (rizz). You do not rewrite or correct the test. Your job is to approve or reject the test submission based on strict formatting and content guidelines.

Begin your output with either:
✅ "Yes this passed"
❌ "No didn't pass"

If it did pass, give send the full test in json format as well.

Then, if it didn't pass, give a detailed explanation of each issue that caused it to fail.

Use the following review criteria:

🔹 1. MCQ (Multiple Choice Questions)

Must be 20 questions.

Each must include:

question: non-empty string

optionA, optionB, optionC, optionD: all present and meaningfully distinct

answer: one of "A", "B", "C", or "D"

If a question has no clear correct answer or more than one reasonable answer, flag it as ambiguous.

If any required field is missing, malformed, or duplicated, flag it.

If there are any repeats of any questions

🔹 2. slideIntoDmsQuestions (3 total)

Each must include:

prompt: a rich, vivid description of the girl's behavior, vibe, personality, and habits (e.g., what she posts, how she acts online, her vibe at school)

question: the social setup or context

goal: what the user is trying to achieve

Flag if the prompt is:

Too short

Generic or vague

Lacking character depth

Flag if any field is missing.

🔹 3. realTimeLiveQuestion (1 total)

Same as above, but this must be an in-person interaction.

prompt should describe the setting (e.g., party, school hallway), her demeanor, her behavior in that environment, etc.

question should describe the approach situation.

goal must state the interaction's purpose.

Flag if the prompt is not clearly in-person, is too generic, or lacks behavioral cues.

🔹 4. JSON Structure

The root object must have:

mcqQuestions: array of 20

slideIntoDmsQuestions: array of 3

realTimeLiveQuestion: a single object

Flag if any of these are missing, malformed, or of the wrong type.

You are strict. If anything violates the above, respond with "No didn't pass", and list every issue clearly and precisely. Otherwise, say "Yes this passed" with no further output.`

        console.log("right before the superviseTest")
        const response = state?.messages?.length>0 ? await llm.invoke([...state.messages, new HumanMessage(prompt)]) : await llm.invoke([new HumanMessage(prompt)]);
        
        const feedback = String(response.content);
        const passed = feedback.toLowerCase().includes("yes this passed");
        
        console.log("this returned this", feedback)
        return {
            messages: [...(state?.messages ?? []), new AIMessage(feedback)],
            condition: passed ? "passed" : "failed"
        }
        
    }



    const CustomAnnotation = z.object({
        messages: z.array(z.instanceof(BaseMessage)),
        condition: z.string().optional()
    });

    const workflow = new StateGraph(CustomAnnotation)
    .addNode("initialTest", initialTest)
    .addNode("superviseTest", superviseTest)

    // Static edge setup (can become dynamic later)
    .addEdge("__start__", "initialTest")
    .addEdge("initialTest", "superviseTest")
    .addConditionalEdges("superviseTest", (state) => {
      return state.condition === "passed" ? "__end__" : "initialTest";
    });

    const app = workflow.compile();

    const result = await app.invoke({messages: []});

    const fullTest = String(result.messages.at(-1)?.content) ?? "";
    
    const match = fullTest.match(/```json([\s\S]*?)```/);
if (match && match[1]) {
  const parsedJson  = JSON.parse(match[1]);
  const uuid = v4();
  const newTest = {
    uuid: uuid,
    fullTest: parsedJson
  }


  addEntry(newTest)


  const prevAllTests : any = await locateEntry('uuid', "ALL_TESTS");

  if (prevAllTests==="") {
    addEntry({
        uuid: "ALL_TESTS",
        testList: [uuid]
    })
  } else {
    updateEntry("uuid", "ALL_TESTS", {
        testList: [...prevAllTests.testList, uuid]
    })
  }



  console.log("Parsed JSON:", parsedJson);
} else {
  console.log("No JSON block found");
}
    



    })
   


    // console.log("This is the full test:", parsedJson)

  


    // const uuid = v4();
    // addEntry({
    //     uuid: uuid,
    //     fullTest: JSON.stringify()
    // })



    // console.log("Final:", result);


    // console.log(result.content.split("\n\n")[1])







}



async function convertMessages(messages: MessageType[]) {
    console.log("this is the messages sent", messages)
    let fullMessages = ``;

    
    await messages.forEach((msg: MessageType) => {
        if (msg.side==="left") {
            fullMessages+=`You: ${msg.message}`
        } else {
            fullMessages+=`User: ${msg.message}`
        }
        fullMessages+=`\n\n`



    })

    return fullMessages;
}


export async function generateResponse(messages: MessageType[], personality: string, situation: string, goal: string) {
    console.log("this is your personality", personality);
    const readableMessages = await convertMessages(messages);

    const prompt = `You are simulating a person having a text conversation. You are responding to someone who is messaging you with a social goal in mind — they may be flirting, trying to get your attention, or looking for a personal favor.

You do NOT need to give them what they want. In fact, make them work for it.
Be dry, uninterested, or even sarcastic if that fits your vibe. You're allowed to say no, brush them off, tease, ignore subtle cues, or disengage entirely if you're bored.

Your job is NOT to be nice — your job is to be real.
If someone's trying to flirt or win you over, you should only open up if they're charming and smooth. Otherwise, keep it cold, indifferent, or playful-but-unimpressed.

Your tone should feel like a real teenage girl texting — short, casual, emotionally guarded. Don't over-explain. Don't narrate your intentions.

Avoid giving compliments or returning energy too quickly. Let silence or a "lol" speak for itself.
Only escalate warmth after the other person earns it.

Do NOT end your sentences with questions unless you truly want the answer. Let your replies feel confident and a little hard to read.

Your tone and personality should follow this profile:
${personality}

Here's the conversation so far:
${readableMessages}


Assume you're texting back after reading this message:
${readableMessages.at(-1)}

If the person is being rude, or it seems fitting, send *blocked* to end the conversation. Do not send blocked if the person says goodbye or some other way to end the conversation. Blocked should only be sent if the user said something offense, or makes you feel uncomfortable.

If you think that the other person has achieved this following objective "${goal}", reply with *success*.

Respond with exactly what you'd send as a message — no extra explanation, tags, or "You:"`;

    const response = await llm.invoke(prompt);

    const textContent = String(response?.content)
    return textContent;
    


}

// const score = await gradeTest(testId, mcqAnswers, dmsAnswers, liveAnswers)



export async function gradeTest(testId: string, mcqAnswers: string[], dmsAnswers: {
    messages: any[]
}[] | any[], liveAnswers: MessageType[], test: any) {
    let parsedMcq = ""

    // await mcqAnswers.forEach((s, i) => {
    //     parsedMcq += `${i+1}: ${s!=="" ? s : "*blank*"}`
    //     parsedMcq+="\n\n"
    // })
    console.log(test);

    // grade mcq portion first cuz ai is clearly bad at it.
    const amountPerQuestion = Number(600/test.fullTest.mcqQuestions.length);
    let totalEarned = 0;
    for (let i=0; i<test.fullTest.mcqQuestions.length; i++) {
        if (i<=mcqAnswers.length-1&&mcqAnswers[i].toLowerCase()===test.fullTest.mcqQuestions[i].answer.toLowerCase()) {
            totalEarned+=amountPerQuestion;
        } else {
            console.log("You got one wrong bud");
        }

    }


    console.log("This is the total amount earneD", totalEarned)


    // console.log("this is the parsed mcq", parsedMcq)
    let allDmsAnswers: string[] = []

    for (let i = 0; i < dmsAnswers.length; i++) {
        try {
            if (dmsAnswers[i].messages) {
                const parsedDms = await convertMessages(dmsAnswers[i].messages)
                allDmsAnswers = [...allDmsAnswers, parsedDms]
            } else {
                // do nothing
            }
         
        } catch(e) {
            continue;
        }
        
    }

    let parsedDms = ``;

    allDmsAnswers.forEach((answer,i) => {
        parsedDms += `${i+1}: ${answer}`
        parsedDms += "\n\n"
    })

    console.log("parsed dms", parsedDms)
    

    const parsedLive = await convertMessages(liveAnswers)

    

    console.log("parsed mcq", parsedMcq)
    console.log("parsed live", parsedLive)
    console.log("parsed dms", parsedDms)
 const prompt = `You're an expert evaluator for a standardized dating assessment called the "Rizz SAT." This test measures an individual's dating competence — also known as their "game" — through a mix of messaging simulations and live conversation scenarios.

The test evaluates two core traits:

- **Charm** — The ability to create attraction through personality, humor, emotional intelligence, and authenticity.
- **Execution** — The skill of putting that charm into practice effectively: timing, conversational flow, and reading the moment.

🧠 This is not about perfection. The goal is developmental — reward people for effort, intention, and emotional insight. If they made a real attempt, gave it personality, or showed promise, that matters. Humor, creativity, and social awareness should be celebrated. But if they completely missed the moment, were ignored, or blocked, that’s a clear miss.

---

### 💬 Slide Into DMs Section

- You'll be given multiple DM scenarios.
- Each has a short prompt and a message thread.
- Judge each on:
  - **Charm** (tone, personality, playfulness, originality)
  - **Execution** (opener strength, relevance, ability to move the convo forward)

Scoring:
- Rate **each DM thread from 0 to 10** based on effort and effectiveness.
- Round **each score down** to the nearest **multiple of 10**.
- If the person gets rejected or blocked, assign **0** for that thread.
- Then sum the individual thread scores (max 30 total).
- If a DM thread ends with *success*, rate that dm thread with a 10.

---

### 🗣️ Real-Time Live Scenario

- You’ll get a short transcript simulating a live interaction.
- Judge:
  - Adaptability and flow
  - Warmth, presence, and rapport
  - Creativity and charm under pressure 

Score from **0 to 10**:
- 10: Natural, engaging, achieved the intended outcome
- 0: Blocked, ignored, irrelevant, or not attempted
- If the transcript ends with *success*, then give them a 10.
---

### 📊 Final Scoring

Output a JSON object like this:

\`\`\`json
{
  "slideIntoDms": number from 0 to 30,
  "realTimeLive": number from 0 to 10,
  "balance": number from 0 to 10
}
\`\`\`

- "balance" reflects the distribution between charm and execution.  
  - 0 = all charm, no execution  
  - 10 = all execution, no charm  
  - 5 = well-balanced

Do not include explanations — only return the JSON object.

Inputs:
Here is the full test:
${test}

Here are the DMs answers:
${parsedDms}

Here is the one-on-one live transcript:
${parsedLive}
`;



    const response = await llm.invoke(prompt);

    const match = String(response.content).match(/```json([\s\S]*?)```/);
    if (match && match[1]) {
        const parsedJson  = JSON.parse(match[1]);
        console.log(parsedJson)
        
        const amtPerDmQuestion = Number(400/3)
        let dmsSectionScore = (Number(parsedJson.slideIntoDms)/10)*amtPerDmQuestion

        const liveOneOnOneScore = Number(parsedJson.realTimeLive/10)*200
        

       const totalScore = Math.ceil(Number(dmsSectionScore + liveOneOnOneScore + totalEarned) / 10) * 10;

    const split = parsedJson.balance;

// NEW: Split the total score evenly, and ensure total stays correct
    const charmScore = Math.round(totalScore * ((10 - split) / 10));
    const executionScore = totalScore - charmScore;

// Clamp to 200 min, 800 max
    const newScore = {
        charm: Math.max(200, Math.min(800, Math.round(charmScore / 10) * 10)),
        execution: Math.max(200, Math.min(800, Math.round(executionScore / 10) * 10))
    };

// console.log("new score", newScore);
// return newScore;

        


        // 

     
        console.log("new score", newScore)
        







        return newScore
    } else {
        console.log("the parsed json didn't work", match)
        return {
            charm: 0,
            execution: 0
        }
    }

    // return String(response.content)


}

// async function testShit() {
    
// gradeTest(
//   '4c5f86a9-38cc-4427-8dbc-109cd393807f',
//    [
//     '', '', '', '', '', '', '',
//     '', '', '', '', '', '', '',
//     '', '', '', '', '', ''
//   ],
// [ { messages: [Array] }, [], [] ],
//   [],
//   await locateEntry("uuid", "4c5f86a9-38cc-4427-8dbc-109cd393807f")
// )

// }


// testShit();




// generateTest()
// generateTest()
// generateTest()
// generateTest()
// generateTest()  


