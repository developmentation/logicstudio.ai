var router = require('express').Router();
const transcribeController = require('../controllers/transcribe');

//Sub Routes
router.post('/', transcribeController.transcribe);

//export the router back to the index.js page
module.exports = router;