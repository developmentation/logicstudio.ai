// composables/useApis.js

export const useApis = () => {
    const executeApiCall = async ({ url, method, payload, token, options = {} }) => {
      try {
        const response = await axios.post("/api/apiActions", {
          url,
          method,
          payload,
          token,
          options
        }, {
          timeout: 60000 // 60 second timeout for the entire operation
        });
  
        // Check if we have a valid response structure
        if (!response?.data?.payload) {
          console.warn("Invalid API response structure", response);
          return {
            success: false,
            error: "Invalid response structure",
            status: response?.status || 500
          };
        }
  
        // Return successful response
        return {
          success: true,
          data: response.data.payload.data,
          status: response.data.payload.status,
          headers: response.data.payload.headers,
          timing: response.data.payload.stats.timing
        };
  
      } catch (error) {
        console.error("API call error", error);
  
        // Handle axios error responses
        if (error.response?.data?.payload) {
          return {
            success: false,
            error: error.response.data.payload.error,
            status: error.response.data.payload.error.status,
            data: error.response.data.payload.error.data,
            headers: error.response.data.payload.error.headers,
            timing: error.response.data.payload.stats.timing
          };
        }
  
        // Handle network or other errors
        return {
          success: false,
          error: {
            message: error.message || "Unknown error occurred",
            status: error.response?.status || 500
          }
        };
      }
    };
  
    return {
      executeApiCall
    };
  };