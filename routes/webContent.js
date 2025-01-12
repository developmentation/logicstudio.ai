var router = require('express').Router();
const webContentController = require('../controllers/webContent');

//Sub Routes
router.post('/', webContentController.processSingleUrl);
router.post('/batch', webContentController.processUrls);

//export the router back to the index.js page
module.exports = router;