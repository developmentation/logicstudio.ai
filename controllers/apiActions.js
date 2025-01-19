const axios = require('axios');
const { ApiError } = require('../error/ApiError');
const packageInfo = require('../package.json');

// Default configuration
const DEFAULT_OPTIONS = {
    timeout: 30000,    // 30 seconds
    maxRetries: 2,
    maxRedirects: 5,
    validateStatus: status => status < 500
};

// Supported HTTP methods
const SUPPORTED_METHODS = ['get', 'post', 'put', 'patch', 'delete'];

// Helper function to validate and parse JSON payload
const validatePayload = (payload, method) => {
    if (!payload) return null;
    if (typeof payload === 'string') {
        try {
            return JSON.parse(payload);
        } catch (error) {
            throw new ApiError.badRequest('Invalid JSON payload');
        }
    }
    return payload;
};

// Helper function to build request headers
const buildHeaders = (token, additionalHeaders = {}) => {
    const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...additionalHeaders
    };

    if (token) {
        headers['Authorization'] = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    }

    return headers;
};

// Smart retry mechanism with exponential backoff
const executeWithRetry = async (requestFn, options = {}) => {
    const maxRetries = options.maxRetries || DEFAULT_OPTIONS.maxRetries;
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await requestFn();
            return response;
        } catch (error) {
            lastError = error;
            
            // Don't retry if it's a 4xx error (client error)
            if (error.response && error.response.status >= 400 && error.response.status < 500) {
                throw error;
            }

            if (attempt < maxRetries) {
                // Calculate delay with exponential backoff
                const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
        }
    }

    throw lastError;
};

// Main API call handler
const makeApiCall = async (url, method, payload, token, options = {}) => {
    if (!url) {
        throw new ApiError.badRequest('URL is required');
    }

    if (!SUPPORTED_METHODS.includes(method.toLowerCase())) {
        throw new ApiError.badRequest(`Unsupported HTTP method: ${method}`);
    }

    const mergedOptions = {
        ...DEFAULT_OPTIONS,
        ...options,
        headers: buildHeaders(token, options.headers)
    };

    const parsedPayload = validatePayload(payload, method);
    
    const requestFn = async () => {
        const requestConfig = {
            url,
            method: method.toLowerCase(),
            ...mergedOptions,
            ...((['post', 'put', 'patch'].includes(method.toLowerCase()) && parsedPayload) && {
                data: parsedPayload
            })
        };

        const response = await axios(requestConfig);
        return response;
    };

    return executeWithRetry(requestFn, mergedOptions);
};

// Controller for handling API requests
exports.handleApiRequest = async function (req, res) {
    const startTime = process.hrtime();
    
    try {
        const { url, method, payload, token, options = {} } = req.body;
        const version = packageInfo.version;

        const response = await makeApiCall(url, method, payload, token, options);
        const [seconds, nanoseconds] = process.hrtime(startTime);

        res.status(200).json({
            message: "API request completed successfully",
            payload: {
                version,
                success: true,
                data: response.data,
                status: response.status,
                headers: response.headers,
                stats: {
                    timing: {
                        timestamp: new Date().toISOString(),
                        duration: seconds + nanoseconds / 1e9,
                        unit: 'seconds'
                    }
                }
            }
        });

    } catch (error) {
        const [seconds, nanoseconds] = process.hrtime(startTime);
        
        // Handle different types of errors
        const errorResponse = {
            message: "API request failed",
            payload: {
                success: false,
                error: {
                    message: error.message,
                    status: error.response?.status,
                    data: error.response?.data,
                    headers: error.response?.headers
                },
                stats: {
                    timing: {
                        timestamp: new Date().toISOString(),
                        duration: seconds + nanoseconds / 1e9,
                        unit: 'seconds'
                    }
                }
            }
        };

        // Send response with appropriate status code
        const statusCode = error.response?.status || 500;
        res.status(statusCode).json(errorResponse);
    }
};