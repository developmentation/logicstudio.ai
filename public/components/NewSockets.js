//NewSockets.js  -- new socket connection for streaming characters back to screen / buffer
import { useRealTime } from "../composables/useRealTime.js";

export default {
    name: 'NewSockets',
    template: `
      <div class="container mx-auto px-4 py-8">

<!--
      {{props}}<br/><br/>
        CompletedMessage: {{completedMessage}}
        PartialMessage: {{partialMessage}}<br/>
        ErrorMessage: {{errorMessage}}<br/>
-->
        Persona {{props?.persona?.name}}: <pre>{{partialMessage? partialMessage : completedMessage}}</pre>

      </div>
    `,
    props: {
        sessionId: {
            type: String,
            default: 'default-session-id',
        },

        persona: {
            type: Object,
            required: false,
            default: () => ({
                url: '',
                name: 'Default Persona',
                description: { en: '' },
                systemPrompt: 'You are a poet with a refine, minimalist approach, focusing on parables open to interpretation',
                userPrompt: 'Write a peom about Alberta',
                messageHistory: {
                    type: Array,
                    default: () => [],
                },


            }),
        },
        model: {
            type: Object,
            required: false,
            default: () => ({
                provider: 'default-provider',
                type: 'default-model',
            }),
        },
        temperature: { type: Number, default: 0.5 },

        trigger: {
            type: Boolean,
            default: false,
        },
        useJson: {
            type: Boolean,
            default: false,
        },


    },
    setup(props, { emit }) {
        // State Management

        const { wsUuid, sessions, sessionsContent, registerSession, unregisterSession, sendToServer } = useRealTime();
        let processing = Vue.ref(false);
        const sessionId = Vue.computed(() => props.sessionId);
        const trigger = Vue.computed(() => props.trigger);
        const persona = Vue.computed(() => props.persona);
        const messageHistory = Vue.computed(() => props.messageHistory);
        const model = Vue.computed(() => props.model); // includes provider and model name for various LLM APIs
        const temperature = Vue.computed(() => props.temperature);
        const useJson = Vue.computed(() => props.useJson);

        const partialMessage = Vue.computed(() => {
            if (sessions?.value) {
                const session = sessions.value[sessionId.value]; // Use the sessionId prop to access the correct session
                return session ? session?.partialMessage : "";
            } else return "";
        });

        const completedMessage = Vue.computed(() => {
            if (sessions?.value) {
                const session = sessions.value[sessionId.value]; // Use the sessionId prop to access the correct session
                return session ? session?.completedMessage : "";
            } else return "";
        });

        const errorMessage = Vue.computed(() => {
            if (sessions?.value) {
                const session = sessions.value[sessionId.value]; // Use the sessionId prop to access the correct session
                return session ? session?.errorMessage : "";
            } else return "";
        });

        Vue.watch(trigger, (newValue, oldValue) => {
            //Execute this socket
            sendMessage();
        });

        Vue.watch(partialMessage, (newValue, oldValue) => {
            emit("messagePartial", { message: newValue, sessionId: sessionId.value });
        });

        Vue.watch(completedMessage, (newValue, oldValue) => {
            processing.value = false;
            emit("messageComplete", { message: newValue, sessionId: sessionId.value });
        });

        Vue.watch(errorMessage, (newValue, oldValue) => {
            if (!oldValue?.length && newValue?.length) {
                console.log("Socket Error", errorMessage)
                emit("messageError");
                sessions.value[sessionId.value].errorMessage = "";
                processing.value = false;
            }
        });

        Vue.onMounted(() => {
            registerSession(sessionId.value, props.persona);
            emit("addSocket", {
                persona: props.persona,
                sessionId: sessionId.value,
            });
        });

        Vue.onBeforeUnmount(() => {
            unregisterSession(sessionId.value);
            emit("removeSocket", {
                persona: props.persona,
                sessionId: sessionId.value,
            });
        });

        function sendMessage() {
            if (wsUuid?.value) {
                if (!processing.value) {
                    if (sessions?.value?.[sessionId?.value])
                        sessions.value[sessionId.value].completedMessage = "";


                    //Always just use message history for passing in the messages

                    // var sysPrompt = props?.persona?.basePrompt || systemPrompt.value || "";
                    // var usePrompt = "Tell me a story";
                    // console.log(sysPrompt)
                    //Format is always : uuid, session, model, temperature, systemPrompt, userPrompt, knowledgeProfileUuids, type

                    // console.log("sysPrompt", sysPrompt)
                    // console.log("userPrompt.value", userPrompt.value)

                    if (persona?.value?.messageHistory?.length == 0) {
                        persona.value.messageHistory = [
                            { role: "system", content: persona.value.systemPrompt },
                            { role: "user", content: persona.value.userPrompt },
                        ];
                    }

                    sendToServer(
                        wsUuid.value, //Websocket connection
                        sessionId.value, //UUID for the Socket
                        model.value.provider || "openAi", //Model provider
                        model.value.model || "gpt-4", //Model name
                        temperature.value, //Tempoerature
                        null, //System prompt
                        null, //The user prompt
                        persona.value.messageHistory, //A longer message history, if a chat function
                        "prompt",
                        useJson.value
                    );
                    processing.value = true;
                }
            }
        }


        return {
            // Variables
            props,
            sendMessage,
            completedMessage,
            partialMessage,
            errorMessage,

            // Methods
        }
    }
}
