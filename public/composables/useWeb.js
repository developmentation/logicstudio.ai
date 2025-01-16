// composables/useWeb.js

export const useWeb = () => {
  const loadWebContent = async (url) => {
    try {
      let webContent = await axios.post("/api/webContent", { url });

      if (!webContent?.data?.payload?.success) {
        // Attempt a local call
        console.log("This request was unsuccessful", webContent);
        return null;
      }

      return webContent.data.payload;
    } catch (error) {
      console.log("Web Loading error", error);
      return null;
    }
  };
  return {
    loadWebContent,
  };
};
