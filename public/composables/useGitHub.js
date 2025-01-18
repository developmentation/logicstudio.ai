// composables/useGitHub.js
 
export const useGitHub = () => {
  const loadGitHubContent = async (owner, repo, branch, token) => {
    try {
      const payload = { owner, repo, branch, token };
      console.log("Attempting to load", payload);

      const response = await axios.post("/api/gitHubContent", payload, {
        timeout: 60000 // 60 second timeout
      });

      if (!response?.data?.payload?.treeData) {
        console.warn("Invalid response structure", response);
        return null;
      }

      return response.data.payload;
    } catch (error) {
      console.error("GitHub Loading error", error?.response?.data || error.message);
      return null;
    }
  };

  const loadFileContent = async (files, token) => {
    try {
      if (!Array.isArray(files)) {
        throw new Error('Files parameter must be an array');
      }

      console.log("Loading files", files)

      const response = await axios.post("/api/gitHubContent/files", { files, token }, {
        timeout: 60000
      });

      if (!response?.data?.payload) {
        console.warn("Invalid file content response", response);
        return null;
      }

      return response.data.payload;
    } catch (error) {
      console.error("GitHub Files Loading Error", error?.response?.data || error.message);
      return null;
    }
  };

  return {
    loadGitHubContent,
    loadFileContent
  };
};