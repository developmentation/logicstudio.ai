var router = require('express').Router();
const gitHubController = require('../controllers/gitHubContent.js');

//Sub Routes
router.post('/', gitHubController.getRepositoryContents);
router.post('/files', gitHubController.downloadRepositoryFiles);
 
//export the router back to the index.js page
module.exports = router;