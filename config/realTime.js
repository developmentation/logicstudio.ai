// realtime.js
/*
Real-time implements dual Websockets and Socket.io protocols as each offers its own benefits
WebSockets are native, while Socket.io enables various protocols. Websockets are often blocked by VPN policy, making them limited in their audience
The client app will select whichever protocol it prefers

*/
const WebSocket = require("ws");
const { Server } = require("socket.io");
const { v4: uuidv4 } = require("uuid");
const { handlePrompt } = require("./handleAiInteractions"); // Import the handlePrompt function

const realTimeClients = {};
const { authenticateAndDecode } = require("../middleware/verify");

async function verifyTokenAndAccount(token) {
  try {
    const tokenDecoded = authenticateAndDecode(token);
    if (!tokenDecoded) return null;
    return null;
    // return await Account.findOne({ username: tokenDecoded.username });
  } catch (error) {
    throw error;
  }
}

function buildPromptConfig(data, account) {
  return {
    account,
    uuid: data.uuid,
    session: data.session,
    model: data.model ,
    temperature: data.temperature,
    systemPrompt: data.systemPrompt,
    userPrompt: data.userPrompt,
    messageHistory: data.messageHistory,
    useJson: data.useJson || false,
  };
}

// Create a WebSocket server
const createRealTimeServers = (server, corsOptions) => {
  // const wss = new WebSocket.Server({ server });

  // const wss = new WebSocket.Server({ noServer: true });
  const io = new Server(server, { cors: corsOptions });

  // // Listen to the 'upgrade' event on the HTTP server
  // server.on("upgrade", (request, socket, head) => {
  //   // Check whether the upgrade request is for Socket.io
  //   if (request.url.startsWith("/socket.io/")) {
  //     // Pass the upgrade request to the Socket.io server
  //     io.engine.handleUpgrade(request, socket, head, (socket) => {
  //       io.engine.emit("connection", socket, request);
  //     });
  //   } else {
  //     // Otherwise, pass the upgrade request to the 'ws' WebSocket server
  //     wss.handleUpgrade(request, socket, head, (ws) => {
  //       wss.emit("connection", ws, request);
  //     });
  //   }
  // });

  // wss.on("connection", (ws) => {
  //   ws.uuid = uuidv4();
  //   ws.realTimeProtocol = "websockets"; // Define the protocol being used
  //   realTimeClients[ws.uuid] = ws;
  //   ws.send(
  //     JSON.stringify({ uuid: ws.uuid, realTimeProtocol: ws.realTimeProtocol })
  //   );
  //   console.log(`Client connected ${ws.uuid} using ${ws.realTimeProtocol}`);
  //   ws.on("message", (message) => {
  //     try {
  //       handleMessage(message, ws);
  //     } catch (error) {
  //       console.error("Error handling message:", error);
  //       ws.send(JSON.stringify({ message: "Error processing message" }));
  //     }
  //   });

  //   ws.on("close", () => {
  //     handleClose(ws.uuid);
  //   });
  // });

  io.on("connection", (socket) => {
    socket.uuid = uuidv4();
    socket.realTimeProtocol = "socket.io";
    realTimeClients[socket.uuid] = socket;
    socket.emit(
      "message",
      JSON.stringify({
        uuid: socket.uuid,
        realTimeProtocol: socket.realTimeProtocol,
      })
    );
    console.log(
      `Client connected ${socket.uuid} using ${socket.realTimeProtocol}`
    );
    socket.on("message", (message) => {
      try {
        handleMessage(message, socket);
      } catch (error) {
        console.error("Error handling message:", error);
        socket.emit(
          "message",
          JSON.stringify({ message: "Error processing message" })
        );
      }
    });

    socket.on("disconnect", () => {
      handleClose(socket.uuid);
    });
  });
};

//This is a single client
const sendToClient = (uuid, session, type, message = null) => {
  const rtClient = realTimeClients[uuid];

  if (rtClient) {
    if (
      rtClient.realTimeProtocol == "websockets" &&
      rtClient.readyState === WebSocket.OPEN
    ) {
      rtClient.send(
        JSON.stringify({
          session,
          type,
          message,
          realTimeProtocol: rtClient.realTimeProtocol,
        })
      );
    }
    if (rtClient.realTimeProtocol == "socket.io") {
      rtClient.emit(
        //emit is the correct type for socket.io, not send
        "message",
        JSON.stringify({
          session,
          type,
          message,
          realTimeProtocol: rtClient.realTimeProtocol,
        })
      );
    }
  } else {
    console.error(`No Client found for UUID: ${uuid}`);
  }
};

async function handleMessage(message, client) {
  try {
    const data = JSON.parse(message);
    if (!data.uuid) {
      sendError(client, "Missing Uuid");
      return;
    }

    if (data.type === "ping") {
      sendToClient(data.uuid, data.session, "pong");
      return;
    }

    if (data.type !== "prompt") {
      sendToClient(
        data.uuid,
        data.session,
        "ERROR",
        "Unrecognized message type"
      );
      return;
    }

    const promptConfig = buildPromptConfig(data, null);
    await handlePrompt(promptConfig, sendToClient);
  } catch (error) {
    console.error("Failed to handle message:", error);
    sendError(client, "Error processing message");
  }
}

function sendError(client, errorMessage) {
  const payload = JSON.stringify({ message: errorMessage });
  if (
    client.realTimeProtocol === "websockets" &&
    client.readyState === WebSocket.OPEN
  ) {
    client.send(payload);
  } else if (client.realTimeProtocol === "socket.io") {
    client.emit("message", payload);
  }
}

function handleClose(uuid) {
  delete realTimeClients[uuid];
}

module.exports = { createRealTimeServers, sendToClient };
