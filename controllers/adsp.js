const { initializeService, adspId } = require("@abgov/adsp-service-sdk");
const { default: axios } = require("axios");
const { io } = require("socket.io-client");

const LOG_CONTEXT = {
  context: "ADSP controller",
};

const FORM_SUBMITTED_STREAM_ID = "form-submitted";

let adsp;
async function initializeAdsp() {
  if (!adsp) {
    // Initialize the ADSP SDK.
    adsp = await initializeService(
      {
        serviceId: adspId`urn:ads:demo:logicstudio.ai`,
        clientSecret: process.env.ADSP_CLIENT_SECRET,
        realm: process.env.ADSP_TENANT_REALM,
        accessServiceUrl: process.env.ADSP_ACCESS_SERVICE_URL,
        directoryUrl: process.env.ADSP_DIRECTORY_URL,
        // Configuration defined event stream for socket.io connection.
        eventStreams: [
          {
            id: FORM_SUBMITTED_STREAM_ID,
            name: "Form submitted updates",
            description: "Provides updates on form submissions",
            subscriberRoles: [
              `urn:ads:platform:tenant-service:platform-service`,
            ],
            publicSubscribe: false,
            events: [
              {
                namespace: "form-service",
                name: "form-submitted",
              },
            ],
          },
        ],
      },
      {}
    );
  }
  return adsp;
}

async function getFormData(directory, tokenProvider, formId) {
  const formServiceUrl = await directory.getServiceUrl(
    adspId`urn:ads:platform:form-service`
  );
  const token = await tokenProvider.getAccessToken();
  const { data } = await axios.get(
    new URL(`/form/v1/forms/${formId}/data`, formServiceUrl).href,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return data;
}

let socket;
const clientContexts = {};

// Connect to event stream via socket.io
async function connectFormSubmissions(config, sendToClient) {
  const { uuid, session } = config;

  const { directory, tokenProvider, logger } = await initializeAdsp();

  const pushServiceUrl = await directory.getServiceUrl(
    adspId`urn:ads:platform:push-service`
  );

  clientContexts[`${uuid}${session}`] = { uuid, session };
  if (!socket) {
    socket = io(pushServiceUrl.href, {
      autoConnect: true,
      reconnection: true,
      query: {
        stream: FORM_SUBMITTED_STREAM_ID,
      },
      transports: ["websocket"],
      withCredentials: true,
      auth: async (cb) => cb({ token: await tokenProvider.getAccessToken() }),
    });

    socket.on("connect", function () {
      logger.info("Connected for form submissions...", LOG_CONTEXT);
      sendToClient(uuid, config.session, "message", {
        type: "form-submitted-updates-status",
        connected: true,
      });
    });

    socket.on("connect_error", function (err) {
      logger.error(
        `Connect to form submission updates failed with error: ${err}`,
        LOG_CONTEXT
      );
    });

    socket.on("disconnect", function (reason) {
      logger.info(
        `Disconnected from form submission updates due to reason: ${reason}`
      );
    });

    socket.on("form-service:form-submitted", async ({ payload }) => {
      if (payload?.form?.id) {
        // Read the form data, which isn't included as part of the event payload.
        const data = await getFormData(directory, tokenProvider, payload.form.id);

        for (const { uuid, session } of Object.values(clientContexts)) {
          sendToClient(uuid, session, "message", {
            type: "form-submitted",
            form: payload.form,
            ...data,
          });
        }
      }
    });
  } else {
    sendToClient(uuid, session, "message", {
      type: "form-submitted-updates-status",
      connected: true,
    });
  }
}

// Disconnect from event stream
async function disconnectFormSubmissions(config, sendToClient) {
  const { uuid, session } = config;
  if (clientContexts[`${uuid}${session}`]) {
    delete clientContexts[`${uuid}${session}`];
  }
  if (!Object.keys(clientContexts).length && socket?.connected) {
    socket.disconnect();
    socket = undefined;
  }
  sendToClient(uuid, session, "message", {
    type: "form-submitted-updates-status",
    connected: false,
  });
}

module.exports = { connectFormSubmissions, disconnectFormSubmissions };
