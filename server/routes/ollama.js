const express = require('express');
const fetch = require('node-fetch');

const router = express.Router();
const OLLAMA_BASE_URL = 'http://localhost:11434';

// Middleware to check Ollama availability
const checkOllamaStatus = async (_, res, next) => {
    try {
        const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
        if (!response.ok) {
            throw new Error('Ollama service unavailable');
        }
        next();
    } catch (error) {
        res.status(503).json({
            error: 'Ollama service unavailable',
            details: 'Please ensure Ollama is running locally'
        });
    }
};

// Get available models
router.get('/models', async (_, res) => {
    try {
        const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
        if (!response.ok) {
            throw new Error('Failed to fetch from Ollama');
        }
        const data = await response.json();
        res.json({ models: data.models }); // Ensure we're sending the models array
    } catch (error) {
        console.error('Ollama error:', error);
        res.status(500).json({ error: error.message, models: [] });
    }
});

// Generate text
router.post('/generate', async (req, res) => {
    try {
        const { model, prompt } = req.body;
        const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, prompt })
        });
        
        if (!response.ok) {
            throw new Error('Ollama generation failed');
        }
        
        const data = await response.json();
        res.json({ text: data.response });
    } catch (error) {
        console.error('Ollama generation error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router; 