// composables/useWeb.js

export const useWeb = () => {
  const loadWebContent = async (url) => {
    try {
      let webContent = await axios.post("/api/webContent", {url});
      return webContent.data.payload;
      console.log
    } catch (error) {
      console.log("Web Loading error")
      return null;
    }
  };
  return {
    loadWebContent,
  };
};
