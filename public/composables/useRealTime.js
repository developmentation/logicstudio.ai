import { useConfigs } from "./useConfigs.js";
const { env } = useConfigs();
// const env = Vue.ref(
//     {WEBSOCKET_URL:"ws://localhost:3000"},
//     {API_URL :"htto://localhost:3000"},
// )   
let ws = null; //Websocket protocol client
let socket = null; // Socket.io client instance
let wsUuid = Vue.ref(null);
let useSocketIo = Vue.ref(false); // State to determine if we should use Socket.io

let pingInterval;
let pongTimeout;
let sessions = Vue.ref({}); // Sessions - Does not need a rework, would work across all

// Additional Computed
let sessionsContent = Vue.computed(() => {
    return Object.keys(sessions.value).map((key) => {
        return {
            content: sessions.value[key].completedMessage || sessions.value[key].partialMessage || '',
            label: 'Socket',
            sessionId: key,
            extracts: extractData(sessions.value[key]?.completedMessage || sessions.value[key]?.partialMessage || '')
        };
    });
});

export function useRealTime() {
    //Websockets
    async function websocketConnection() {
        clearInterval(pingInterval);
        clearTimeout(pongTimeout);

        if (!ws) {
            ws = new WebSocket(env.value.WEBSOCKET_URL);
            ws.addEventListener('open', commonHandleOpen);
            ws.addEventListener('message', commonHandleMessage);
            ws.addEventListener('close', commonHandleClose);
            ws.addEventListener('error', commonHandleError);
        }
    }

    //Socket IO
    function socketIoConnection() {
        socket = io(env.value.API_URL,

            {
                reconnection: true,             // whether to reconnect automatically
                reconnectionAttempts: Infinity, // number of reconnection attempts before giving up
                reconnectionDelay: 3000,        // initial delay in ms to start reconnections
                reconnectionDelayMax: 5000,     // maximum delay in ms between reconnection attempts
                randomizationFactor: 0.5        // randomization factor for delay calculation
            }
        );
        socket.on('connect', commonHandleOpen);
        socket.on('message', commonHandleMessage);
        socket.on('disconnect', commonHandleClose);
        socket.on('connect_error', commonHandleError);
    }

    /* COMMON FUNCTIONS */
    function commonHandleOpen() {
        console.log('Connection opened');
        pingInterval = setInterval(() => {
            sendPing();
        }, 5000);
    }

    function commonHandleMessage(data) {
        if (typeof data === 'string') {
            // WebSocket message received as a string
            data = JSON.parse(data);
        }

        // If the message contains a uuid, store it in the ref variable
        if (data.uuid) {
            wsUuid.value = data.uuid;
            console.log('Received a UUID', wsUuid.value);
        }

        // Handle the rest of the message processing
        processMessage(data);
    }

    function processMessage(data) {
        try {
            if (data.session && sessions.value[data.session]) {
                // Check if the partialMessage exists for the session, if not create it
                if (!sessions.value[data.session].partialMessage) {
                    sessions.value[data.session].partialMessage = '';
                }

                if (data.type === 'EOM') {
                    sessions.value[data.session].completedMessage = sessions.value[data.session].messages.join('');

                    // Reset the partial message
                    sessions.value[data.session].messages = []; // Reset messages for the session
                    sessions.value[data.session].partialMessage = '';
                    sessions.value[data.session].status = 'complete';
                } else if (data.type === 'ERROR') {
                    console.log('Error in LLM response:', data);

                    var errorMessage = 'Error: ';

                    sessions.value[data.session].status = 'waiting'; //Set a waiting status, to retry once available.
                    sessions.value[data.session].errorMessage = errorMessage + data.message;

                    // Clean up messages to avoid memory bloat
                    sessions.value[data.session].messages = []; // Reset messages for the session
                    sessions.value[data.session].partialMessage = '';
                    sessions.value[data.session].completedMessage = '';
                } else {
                    // Update the partial message with the new fragment
                    sessions.value[data.session].messages.push(data.message);
                    sessions.value[data.session].partialMessage += data.message;
                    sessions.value[data.session].status = 'inProgress';
                }
            }
        } catch (error) {
            console.log('Error with websocket message', error);
        }
    }

    function commonHandleClose() {
        console.log('Connection closed');
        wsUuid.value = null;

        clearInterval(pingInterval);
        clearTimeout(pongTimeout);

        // Remove event listeners
        if (ws) {
            ws.removeEventListener('open', commonHandleOpen);
            ws.removeEventListener('message', commonHandleMessage);
            ws.removeEventListener('close', commonHandleClose);
            ws.removeEventListener('error', commonHandleError);
            ws = null;
        }
        if (socket) {
            socket.off('connect', commonHandleOpen);
            socket.off('message', commonHandleMessage);
            socket.off('disconnect', commonHandleClose);
            socket.off('connect_error', commonHandleError);
            socket = null;
        }

        // retryConnection();
    }

    function commonHandleError(event) {
        console.error('Connection error:', event);
    
        // Clear the current connection instances
        if (ws) {
            ws = null;
        } else if (socket) {
            socket = null;
        }
    
        // Trigger a retry which will alternate to the other connection method
        // retryConnection();
    }

    function sendPing() {
        if (ws) {
            ws.send(JSON.stringify({ type: 'ping' }));
        } else if (socket && socket.connected) {
            socket.emit('message', JSON.stringify({ type: 'ping' }));
        }
    }

    //Retry Connection

    function retryConnection() {
        console.log('Retrying connection...');
        setTimeout(() => {
            if (useSocketIo.value) {
                // If the flag is set to use Socket.io, attempt that connection
                console.log('Attempting to connect with Socket.io...');
                socketIoConnection();
            } else {
                // Otherwise, attempt a WebSocket connection
                console.log('Attempting to connect with WebSocket...');
                websocketConnection();
            }
            // Toggle the flag to alternate on the next retry
            useSocketIo.value = !useSocketIo.value;
        }, 3000); // Retry after 3 seconds
    }

    // Send to Server function
    function sendToServer(uuid, session, provider, model, temperature, systemPrompt, userPrompt, messageHistory, type, useJson) {
        if (ws) {
            let wsSendVars = { token: null, uuid, session, provider, model, temperature, systemPrompt, userPrompt, messageHistory, type, useJson };
            console.log("wsSendVars", wsSendVars)
            ws.send(JSON.stringify(wsSendVars));
        } else if (socket && socket.connected) {
            let socketSendVars = { token: null, uuid, session, provider, model, temperature, systemPrompt, userPrompt, messageHistory, type, useJson };
            socket.emit('message', JSON.stringify(socketSendVars));
        }
    }

    //Register and Unregister
    function registerSession(session, persona, callback) {
        sessions.value[session] = { callback, messages: [], status: 'idle', partialMessage: '', completedMessage: '', persona: persona };
    }

    function unregisterSession(session) {
        console.log('Deleted session', session);
        clearSessionData(session);
        delete sessions.value[session];
    }

    function clearSessionData(sessionId) {
        if (sessions.value[sessionId]) {
            sessions.value[sessionId].messages = [];
            sessions.value[sessionId].partialMessage = '';
            sessions.value[sessionId].completedMessage = '';
            // Any other cleanup that is needed for a session
        }
    }

    return {
        ws,
        socket,
        wsUuid,
        useSocketIo,
        sessions,
        sessionsContent,
        retryConnection,
        websocketConnection,
        socketIoConnection,

        sendToServer,
        registerSession,
        unregisterSession
    };
}
