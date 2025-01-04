var router = require('express').Router();
const healthcheckController = require('../controllers/_config/healthcheck');

//Sub Routes
router.get('/', healthcheckController.doHealthcheck);
router.post('/', healthcheckController.doHealthcheck);

//export the router back to the index.js page
module.exports = router;