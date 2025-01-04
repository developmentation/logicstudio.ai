const express = require('express');

// Accepts a new account and saves it to the database
exports.doHealthcheck = async function (req, res, next) {
     res.status(201).send({message:"Healthcheck confirmed", payload:true});
};