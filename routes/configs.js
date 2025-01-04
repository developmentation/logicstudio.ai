var router = require('express').Router();
const configsController = require('../controllers/_config/configs');

//Sub Routes
router.get('/', configsController.getConfigs);
router.post('/', configsController.getConfigs);

//export the router back to the index.js page
module.exports = router;