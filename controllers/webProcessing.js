const axios = require('axios');
const cheerio = require('cheerio');
const { ApiError } = require('../errors/ApiError');
const packageInfo = require('../package.json');

// Legacy User-Agent strings for fallback
const legacyUserAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/122.0'
];

// Get random legacy User-Agent
const getRandomUserAgent = () => {
    const index = Math.floor(Math.random() * legacyUserAgents.length);
    return legacyUserAgents[index];
};

// Modern headers configuration with Client Hints
const getModernHeaders = () => ({
    // Client Hints
    'Sec-CH-UA': '"Not_A Brand";v="8", "Chromium";v="120", "Microsoft Edge";v="120"',
    'Sec-CH-UA-Mobile': '?0',
    'Sec-CH-UA-Platform': '"Windows"',
    'Sec-CH-UA-Platform-Version': '"15.0.0"',
    'Sec-CH-UA-Arch': '"x86"',
    'Sec-CH-UA-Model': '""',
    'Sec-CH-UA-Full-Version-List': '"Microsoft Edge";v="120.0.2210.121"',
    
    // Fetch metadata
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    
    // Standard headers
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'DNT': '1',
    'Upgrade-Insecure-Requests': '1',
    
    // Legacy fallback
    'User-Agent': getRandomUserAgent()
});

// Smart retry mechanism with fallback
const smartFetch = async (url, options, retryCount = 0) => {
    const maxRetries = options.maxRetries || 2;
    const headers = { ...getModernHeaders(), ...options.headers };
    
    try {
        const response = await axios.get(url, {
            headers,
            timeout: options.timeout || 30000,
            maxRedirects: options.maxRedirects || 5,
            validateStatus: status => status < 500,
            ...(options.proxy && { proxy: options.proxy }),
            ...(options.httpsAgent && { httpsAgent: options.httpsAgent })
        });

        return response;
    } catch (error) {
        if (retryCount < maxRetries) {
            // On failure, retry with progressively simplified headers
            const fallbackHeaders = retryCount === 0 ? 
                // First retry: Keep User-Agent but remove Client Hints
                {
                    'User-Agent': getRandomUserAgent(),
                    'Accept': headers.Accept,
                    'Accept-Language': headers['Accept-Language'],
                    'Accept-Encoding': headers['Accept-Encoding']
                } :
                // Second retry: Minimal headers
                {
                    'User-Agent': getRandomUserAgent(),
                    'Accept': '*/*'
                };

            console.warn(`Retry ${retryCount + 1} for ${url} with fallback headers`);
            return smartFetch(url, { ...options, headers: fallbackHeaders }, retryCount + 1);
        }
        throw error;
    }
};

// Function to process a single URL
const processSingleUrl = async (url, options = {}) => {
    try {
        const response = await smartFetch(url, options);

        if (response.status !== 200) {
            throw new Error(`Failed to fetch ${url}. Status: ${response.status}`);
        }

        const $ = cheerio.load(response.data);

        // Remove unwanted elements
        $('script').remove();
        $('style').remove();
        $('img').remove();
        $('iframe').remove();
        $('noscript').remove();
        $('svg').remove();

        // Extract text content with improved whitespace handling
        const text = $('body')
            .text()
            .replace(/[\s\n\r]+/g, ' ')
            .trim();

        // Extract all links with improved handling
        const links = new Set();
        $('a').each((_, element) => {
            const href = $(element).attr('href');
            if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
                try {
                    const absoluteUrl = new URL(href, url).href;
                    links.add(absoluteUrl);
                } catch (e) {
                    console.warn(`Invalid URL found: ${href}`);
                }
            }
        });

        return {
            url,
            text,
            html: response.data,
            links: Array.from(links),
            success: true,
            metadata: {
                contentType: response.headers['content-type'],
                lastModified: response.headers['last-modified'],
                contentLength: response.headers['content-length'],
                status: response.status,
                headers: response.headers, // Include headers used for debugging
                retryCount: response.config?.retryCount || 0
            }
        };
    } catch (error) {
        return {
            url,
            error: error.message,
            success: false
        };
    }
};

// Batch processing with concurrency control
const processBatch = async (urls, options, batchSize = 5) => {
    const results = [];
    for (let i = 0; i < urls.length; i += batchSize) {
        const batch = urls.slice(i, i + batchSize);
        const batchResults = await Promise.all(
            batch.map(url => processSingleUrl(url, options))
        );
        results.push(...batchResults);
        
        // Add delay between batches if specified
        if (options.batchDelay && i + batchSize < urls.length) {
            await new Promise(resolve => setTimeout(resolve, options.batchDelay));
        }
    }
    return results;
};

// Default configuration
const DEFAULT_OPTIONS = {
    batchSize: 5,
    batchDelay: 1000,  // 1 second delay between batches
    timeout: 30000,    // 30 seconds
    maxRetries: 2,
    maxRedirects: 5
};

exports.processUrls = async function (req, res, next) {
    try {
        // Accept either an array of URLs or an object with urls and options
        const { urls, options } = Array.isArray(req.body) ? { urls: req.body, options: {} } : req.body;
        const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
        const version = packageInfo.version;

        if (!urls || !Array.isArray(urls)) {
            throw ApiError.badRequest('URLs must be provided as an array');
        }

        const startTime = process.hrtime();
        const results = await processBatch(urls, options, options.batchSize || 5);
        const [seconds, nanoseconds] = process.hrtime(startTime);

        // Filter and categorize results
        const successful = results.filter(result => result.success);
        const failed = results.filter(result => !result.success);

        res.status(200).json({
            message: "Scraping completed",
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
        if (error instanceof ApiError) {
            next(error);
        } else {
            next(ApiError.internal("An error occurred while scraping URLs"));
        }
    }
};

exports.processSingleUrl = async function (req, res, next) {
    try {
        // Accept either a string URL or an object with url and options
        const { url, options } = typeof req.body === 'string' ? { url: req.body, options: {} } : req.body;
        const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
        const version = packageInfo.version;

        if (!url || typeof url !== 'string') {
            throw ApiError.badRequest('A valid URL must be provided');
        }

        const startTime = process.hrtime();
        const result = await processSingleUrl(url, options);
        const [seconds, nanoseconds] = process.hrtime(startTime);

        res.status(200).json({
            message: "Scraping completed",
            payload: {
                version,
                ...result,
                timing: {
                    timestamp: new Date().toISOString(),
                    duration: seconds + nanoseconds / 1e9,
                    unit: 'seconds'
                }
            }
        });
    } catch (error) {
        if (error instanceof ApiError) {
            next(error);
        } else {
            next(ApiError.internal("An error occurred while scraping the URL"));
        }
    }
};