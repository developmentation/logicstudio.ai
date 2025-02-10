var router = require('express').Router();
const modelsController = require('../controllers/_config/models');

//Sub Routes
router.get('/', modelsController.getModels);

//export the router back to the index.js page
module.exports = router;