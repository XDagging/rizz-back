// websocket.ts
import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage, Server } from 'http';
import { sessionMiddleware } from './app';
import passport from 'passport';
import type { Socket } from 'net';
import type { MessageType } from './types';
import { ChatOpenAI } from '@langchain/openai';
import { locateEntry } from './databaseFunctions';


function wrapMiddleware(middleware: any) {
  return (req: IncomingMessage, res: any) =>
    new Promise<void>((resolve, reject) => {
      middleware(req, res, (err: any) => {
        if (err) reject(err);
        else resolve();
      });
    });
}
interface AuthenticatedRequest extends IncomingMessage {
  user?: any; // or `User` if you have a user type
  isAuthenticated?: () => boolean;
}


type Request = {
    code: "ok" | "err";
    payload: string;
    time: number;
    testId?: string;

}

const llm = new ChatOpenAI({
    temperature: 0,
    model: "gpt-4o-mini",
       
});


type CONNECTION_STATUS = "STARTED" | "NOT YET"

// Need to ship this out by tomorrow at 7:30.
export default function startWebsocket(server: Server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', async (req: AuthenticatedRequest, socket: Socket, head: Buffer) => {
    const res = {
      getHeader() {},
      setHeader() {},
      end() {}
    };

    try {
      // Apply Express-style middleware
      await wrapMiddleware(sessionMiddleware)(req, res);
      await wrapMiddleware(passport.initialize())(req, res);
      await wrapMiddleware(passport.session())(req, res);

      if (!req.isAuthenticated?.()) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      // Upgrade the connection
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });

    } catch (err) {
      console.error('WebSocket auth error:', err);
      socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
      socket.destroy();
    }
  });

  wss.on('connection', (ws: WebSocket, req: AuthenticatedRequest) => {
    const user = req.user;
    const allMessages: MessageType[] = [];
    console.log('Authenticated WS user:', user);

    const CONNECTION_STATUS: CONNECTION_STATUS = "NOT YET"
    let testId: null | string = null;
    let prompt: null | string = null;

    const timeout = setTimeout(() => {
        ws.close();
        // 2 minute and 30 seconds per user 
    },5*30*1000)

    // Handle messages
    ws.on('message', async (msg: any) => {
        try {



            const d : Request = JSON.parse(msg.toString());



            if (CONNECTION_STATUS === "NOT YET") {

                if (d.testId) {
                    const test: any = await locateEntry("uuid", d.testId)
                    if (test!=="") {
                        prompt = test.fullTest.realTimeLiveQuestion.prompt;


                        const res : Request = {
                            code: "ok",
                            payload: "",
                            time: Date.now()
                        }
                        
                        ws.send(res);

                    } else {
                        ws.close();
                    }
                    
     


                } else {
                    ws.close();
                }
                

                // In theory, this is a vulnerabiliy. Someone could put an ID that doesn't correspond to their prompt and get an entirely different personality.

            } else {
                
                const readableMessages = [{

                }]


          

            }

            // 


            // llm.invoke()
            // craft response;


            


            




        } catch(e) {
            console.error("Something went really wrong here:", msg);

            // ws.send()
        }




        console.log(`User ${user} says:`, msg.toString());
    });

    ws.on('close', () => {
      console.log(`User ${user?.username} disconnected.`);
    });
  });
}
