var router = require('express').Router();
const textToSpeechController = require('../controllers/textToSpeech');

//Sub Routes
router.post('/', textToSpeechController.generateAudio);

//export the router back to the index.js page
module.exports = router;