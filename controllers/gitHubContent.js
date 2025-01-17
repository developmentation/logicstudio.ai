const axios = require('axios');
const { ApiError } = require('../error/ApiError');
const packageInfo = require('../package.json');

// Default configuration
const DEFAULT_OPTIONS = {
    batchSize: 5,
    batchDelay: 1000,
    timeout: 30000,
    maxRetries: 2,
    maxRedirects: 5
};

// GitHub API configuration
const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;



// GitHub API client configuration
const githubClient = axios.create({
    baseURL: GITHUB_API_BASE,
    timeout: 30000,
    headers: {
        'Accept': 'application/vnd.github.v3+json',
        ...(GITHUB_TOKEN && { 'Authorization': `token ${GITHUB_TOKEN}` })
    }
});
async function getDefaultBranch(owner, repo) {
    try {
        const response = await githubClient.get(`/repos/${owner}/${repo}`);
        return response.data.default_branch;
    } catch (error) {
        console.error(`Error fetching repository info:`, error.message);
        throw error;
    }
}

async function fetchRepoContents(owner, repo, branch) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000); // 25s timeout

    try {
        // Get the branch's commit SHA
        const refResponse = await githubClient.get(`/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
            signal: controller.signal
        });
        const commitSha = refResponse.data.object.sha;

        // Get the full tree in one request
        const treeResponse = await githubClient.get(`/repos/${owner}/${repo}/git/trees/${commitSha}`, {
            params: { recursive: 1 },
            signal: controller.signal
        });

        clearTimeout(timeout);

        if (treeResponse.data.truncated) {
            console.warn('Repository tree was truncated due to size. Some files may be missing.');
        }

        // Transform and return only what we need
        return treeResponse.data.tree
            .filter(item => item.type === 'blob' || item.type === 'tree') // Only include files and directories
            .map(item => ({
                name: item.path.split('/').pop(),
                path: item.path,
                download_url: `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${item.path}`,
                html_url: `https://github.com/${owner}/${repo}/blob/${branch}/${item.path}`,
                size: item.size || 0,
                sha: item.sha,
                type: item.type === 'blob' ? 'file' : 'directory'
            }));
    } catch (error) {
        clearTimeout(timeout);
        
        if (error.name === 'AbortError') {
            throw new Error(`Request timeout while fetching repository contents for ${owner}/${repo}`);
        }

        // If the tree API fails, fall back to the contents API with a new timeout
        const fallbackTimeout = setTimeout(() => controller.abort(), 25000);
        try {
            console.warn('Git Tree API failed, falling back to contents API');
            const response = await githubClient.get(`/repos/${owner}/${repo}/contents`, {
                params: { ref: branch },
                signal: controller.signal
            });

            const files = [];
            const queue = [...response.data];

            while (queue.length > 0) {
                const item = queue.shift();
                
                if (item.type === 'file') {
                    files.push({
                        name: item.name,
                        path: item.path,
                        download_url: item.download_url,
                        html_url: item.html_url,
                        size: item.size || 0,
                        sha: item.sha,
                        type: item.type
                    });
                } else if (item.type === 'dir') {
                    const subResponse = await githubClient.get(item._links.self, {
                        signal: controller.signal
                    });
                    queue.push(...subResponse.data);
                }
            }

            clearTimeout(fallbackTimeout);
            return files;
        } catch (fallbackError) {
            clearTimeout(fallbackTimeout);
            if (fallbackError.name === 'AbortError') {
                throw new Error(`Request timeout while fetching repository contents for ${owner}/${repo}`);
            }
            throw fallbackError;
        }
    }
}
// Convert flat file array to hierarchical structure
const createFileHierarchy = (files) => {
    const root = {
        type: 'directory',
        name: 'root',
        path: '',
        children: {},
        meta: {
            totalFiles: 0,
            totalSize: 0
        }
    };

    for (const file of files) {
        const pathParts = file.path.split('/');
        let currentLevel = root.children;
        let currentPath = '';

        // Process each part of the path
        for (let i = 0; i < pathParts.length; i++) {
            const part = pathParts[i];
            currentPath = currentPath ? `${currentPath}/${part}` : part;
            
            if (i === pathParts.length - 1) {
                currentLevel[part] = {
                    type: 'file',
                    name: part,
                    path: currentPath,
                    size: file.size,
                    sha: file.sha,
                    download_url: file.download_url,
                    html_url: file.html_url,
                    meta: file.metadata || {}
                };
                root.meta.totalFiles++;
                root.meta.totalSize += file.size || 0;
            } else {
                if (!currentLevel[part]) {
                    currentLevel[part] = {
                        type: 'directory',
                        name: part,
                        path: currentPath,
                        children: {},
                        meta: {
                            totalFiles: 0,
                            totalSize: 0
                        }
                    };
                }
                currentLevel = currentLevel[part].children;
            }
        }
    }

    // Calculate directory stats
    const calculateDirStats = (node) => {
        if (node.type === 'file') {
            return { files: 1, size: node.size || 0 };
        }

        let totalFiles = 0;
        let totalSize = 0;

        Object.values(node.children).forEach(child => {
            const stats = calculateDirStats(child);
            totalFiles += stats.files;
            totalSize += stats.size;
        });

        node.meta.totalFiles = totalFiles;
        node.meta.totalSize = totalSize;

        return { files: totalFiles, size: totalSize };
    };

    calculateDirStats(root);
    return root;
};

// Download file content
const downloadFile = async (fileInfo, options = {}) => {
    try {
        const response = await githubClient.get(fileInfo.download_url, {
            responseType: fileInfo.name.match(/\.(jpg|jpeg|png|gif|ico|svg)$/i) ? 'arraybuffer' : 'text',
            timeout: options.timeout || 30000,
            maxRedirects: options.maxRedirects || 5,
            validateStatus: status => status < 500
        });

        if (response.status !== 200) {
            throw new Error(`Failed to fetch ${fileInfo.path}. Status: ${response.status}`);
        }

        return {
            ...fileInfo,
            content: response.data,
            success: true,
            metadata: {
                contentType: response.headers['content-type'],
                lastModified: response.headers['last-modified'],
                contentLength: response.headers['content-length'],
                status: response.status,
                headers: response.headers
            }
        };
    } catch (error) {
        return {
            ...fileInfo,
            error: error.message,
            success: false
        };
    }
};

// Batch processing with concurrency control
const processBatch = async (files, options, batchSize = 5) => {
    const results = [];
    for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);
        const batchResults = await Promise.all(
            batch.map(file => downloadFile(file, options))
        );
        results.push(...batchResults);
        
        if (options.batchDelay && i + batchSize < files.length) {
            await new Promise(resolve => setTimeout(resolve, options.batchDelay));
        }
    }
    return results;
};



const createPrimeVueTreeStructure = (files) => {
    console.log('Starting tree creation with', files.length, 'files');
    
    // Initialize root
    const root = {
        key: 'root',
        label: '/',
        data: {
            path: '',
            type: 'directory',
            meta: { totalFiles: 0, totalSize: 0 }
        },
        children: []
    };

    // Initialize directory cache
    const dirCache = new Map([['', root]]);

    console.log('Building directory structure...');
    
    // First, build all directory paths
    files.forEach((file, index) => {
        const pathParts = file.path.split('/');
        let currentPath = '';

        // Create each directory in the path if it doesn't exist
        for (let i = 0; i < pathParts.length - 1; i++) {
            const part = pathParts[i];
            const parentPath = currentPath;
            currentPath = currentPath ? `${currentPath}/${part}` : part;

            if (!dirCache.has(currentPath)) {
                const dirNode = {
                    key: currentPath,
                    label: part,
                    data: {
                        path: currentPath,
                        type: 'directory',
                        meta: { totalFiles: 0, totalSize: 0 }
                    },
                    children: []
                };
                dirCache.set(currentPath, dirNode);

                // Add to parent
                const parent = dirCache.get(parentPath);
                if (parent) {
                    parent.children.push(dirNode);
                }
            }
        }
    });

    console.log('Adding files to structure...');

    // Then add all files
    files.forEach((file, index) => {
        const pathParts = file.path.split('/');
        const fileName = pathParts.pop();
        const parentPath = pathParts.join('/');

        const fileNode = {
            key: file.path,
            label: fileName,
            data: {
                ...file,
                type: 'file'
            },
            leaf: true
        };

        // Add file to its parent directory
        const parent = dirCache.get(parentPath) || root;
        parent.children.push(fileNode);
    });

    console.log('Updating directory statistics...');

    // Update directory statistics
    const updateDirStats = (node) => {
        if (node.leaf) {
            return {
                files: 1,
                size: node.data.size || 0
            };
        }

        let totalFiles = 0;
        let totalSize = 0;

        for (const child of node.children) {
            const stats = updateDirStats(child);
            totalFiles += stats.files;
            totalSize += stats.size;
        }

        node.data.meta.totalFiles = totalFiles;
        node.data.meta.totalSize = totalSize;

        return { files: totalFiles, size: totalSize };
    };

    updateDirStats(root);

    console.log('Sorting tree...');

    // Sort all directories
    const sortDir = (node) => {
        if (node.children && node.children.length > 0) {
            // Sort current level
            node.children.sort((a, b) => {
                // Directories first
                if (a.leaf !== b.leaf) {
                    return a.leaf ? 1 : -1;
                }
                // Then alphabetically
                return a.label.localeCompare(b.label);
            });

            // Sort subdirectories
            node.children.forEach(child => {
                if (!child.leaf) {
                    sortDir(child);
                }
            });
        }
    };

    sortDir(root);

    console.log('Tree creation complete');
    return root;
};

// Simplified file icon helper
const getFileIcon = (fileName) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const icons = {
        js: 'pi pi-code',
        jsx: 'pi pi-code',
        ts: 'pi pi-code',
        tsx: 'pi pi-code',
        vue: 'pi pi-code',
        css: 'pi pi-palette',
        scss: 'pi pi-palette',
        html: 'pi pi-globe',
        json: 'pi pi-database',
        md: 'pi pi-file-edit',
        txt: 'pi pi-file-edit',
        png: 'pi pi-image',
        jpg: 'pi pi-image',
        jpeg: 'pi pi-image',
        gif: 'pi pi-image',
        svg: 'pi pi-image'
    };
    return icons[ext] || 'pi pi-file';
};

exports.getRepositoryContents = async function (req, res, next) {
    const startTime = process.hrtime();
    
    try {
        const { owner, repo, branch: requestedBranch, options = {} } = req.body;
        const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
        const version = packageInfo.version;

        if (!owner || !repo) {
            throw ApiError.badRequest('Repository owner and name must be provided');
        }

        // Get the default branch if none specified
        const branch = requestedBranch || await getDefaultBranch(owner, repo);
        console.log(`Using branch: ${branch} for repository ${owner}/${repo}`);

        // Fetch all files with a timeout
        const fetchPromise = fetchRepoContents(owner, repo, branch);
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Fetch timeout')), 30000)
        );

        const files = await Promise.race([fetchPromise, timeoutPromise]);
        console.log(`Fetched ${files.length} files, converting to tree structure`);

        // Convert to tree structure with a timeout
        const treePromise = new Promise((resolve) => {
            const treeData = createPrimeVueTreeStructure(files);
            resolve(treeData);
        });
        
        const treeData = await Promise.race([
            treePromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Tree creation timeout')), 30000))
        ]);

        console.log('Tree structure created successfully');

        const [seconds, nanoseconds] = process.hrtime(startTime);

        // Send response in chunks if it's large
        const response = {
            message: "Repository contents fetched successfully",
            payload: {
                version,
                repository: {
                    owner,
                    repo,
                    branch
                },
                treeData,
                stats: {
                    totalFiles: files.length,
                    timing: {
                        timestamp: new Date().toISOString(),
                        duration: seconds + nanoseconds / 1e9,
                        unit: 'seconds'
                    }
                }
            }
        };

        // If response is very large, use streaming
        if (JSON.stringify(response).length > 1000000) { // > 1MB
            res.setHeader('Transfer-Encoding', 'chunked');
            res.write(JSON.stringify(response));
            res.end();
        } else {
            res.json(response);
        }

    } catch (error) {
        console.error('Error in getRepositoryContents:', error);
        res.status(500).json({
            payload: {
                message: error.message,
                status: error.response?.status,
                statusText: error.response?.statusText
            }
        });
    }
};

// Controller for downloading specific files
exports.downloadRepositoryFiles = async function (req, res, next) {
    try {
        const { files, options = {} } = req.body;
        const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
        const version = packageInfo.version;

        if (!files || !Array.isArray(files)) {
            throw ApiError.badRequest('Files must be provided as an array');
        }

        const startTime = process.hrtime();
        const results = await processBatch(files, mergedOptions, mergedOptions.batchSize);
        const [seconds, nanoseconds] = process.hrtime(startTime);

        const successful = results.filter(result => result.success);
        const failed = results.filter(result => !result.success);

        res.status(200).json({
            message: "Files downloaded successfully",
            payload: {
                version,
                successful,
                failed,
                stats: {
                    totalProcessed: results.length,
                    successCount: successful.length,
                    failureCount: failed.length,
                    timing: {
                        timestamp: new Date().toISOString(),
                        duration: seconds + nanoseconds / 1e9,
                        unit: 'seconds'
                    }
                }
            }
        });
    } catch (error) {
        res.status(500).json({payload: error});
    }
};