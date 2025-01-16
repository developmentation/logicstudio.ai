async function getGitHubFiles(owner, repo, branch = 'main') {
  const baseUrl = `https://api.github.com/repos/${owner}/${repo}`;
 
  // Function to recursively get files from a directory
  async function getFilesInPath(path = '') {
    const response = await fetch(`${baseUrl}/contents/${path}?ref=${branch}`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        // Add Authorization header if you need higher rate limits:
         'Authorization': 'token YOURTOKEN'
      }
    });
   
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.statusText}`);
    }
   
    const contents = await response.json();
    let files = [];
   
    for (const item of contents) {
      if (item.type === 'file') {
        files.push({
          name: item.name,
          path: item.path,
          download_url: item.download_url,
          html_url: item.html_url,
          size: item.size,
          sha: item.sha,
          type: item.type
        });
      } else if (item.type === 'dir') {
        // Recursively get files from subdirectories
        const subFiles = await getFilesInPath(item.path);
        files = files.concat(subFiles);
      }
    }
   
    return files;
  }
 
  try {
    const files = await getFilesInPath();
    const result = {
      repository: {
        full_name: `${owner}/${repo}`,
        branch: branch,
        url: `https://github.com/${owner}/${repo}`,
        api_url: baseUrl
      },
      total_files: files.length,
      files: files
    };
 
    return result;
  } catch (error) {
    console.error('Error fetching repository contents:', error);
    throw error;
  }
}
 
// Example usage:
async function main() {
  try {
    // Example with a popular repository
    const fileList = await getGitHubFiles('developmentation', 'logicstudio.ai', 'main');
   
    // Pretty print the JSON
    console.log(JSON.stringify(fileList, null, 2));
   
    // Example of how to save to a file (if running in Node.js)
    // const fs = require('fs');
    // fs.writeFileSync('repo-files.json', JSON.stringify(fileList, null, 2));
   
    // Example of filtering specific file types
    const jsFiles = fileList.files.filter(file => file.name.endsWith('.js'));
    console.log(`\nJavaScript files found: ${jsFiles.length}`);
  } catch (error) {
    console.error('Error:', error);
  }
}
 
// Run the example
main();
