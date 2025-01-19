var router = require('express').Router();
const apiActionsController = require('../controllers/apiActions.js');

//Sub Routes
router.post('/', apiActionsController.handleApiRequest);

//export the router back to the index.js page
module.exports = router;