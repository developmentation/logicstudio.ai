const uuidv4 = require("uuid").v4;
const ApiError = require("../error/ApiError");
const crypto = require("crypto");
const { createJWT } = require("../middleware/verify");

//Import the schemas and the validator function
//The validator is used to enforce the JSON structure, not the schemas.
const { validateAgainstSchema } = require("../models/joi/common/validate");

//Bring in the schemas to be used
const AccountSchemaJoi = require("../models/joi/Account");
const tableDef = require("../models/mssql/Account").tableDef;
const SchemaMsSql = require("../models/mssql/Account").Account;
const SchemaMongo = require("../models/mongo/Account").Account;

//Bring in DAL functions
const {
  createTableIfNotExists,
  createMethodsArray,
  performDatabaseOperation,
} = require("../dal/common/commonDal");

//DECIDE WHICH DATABASE METHODS AND SCHEMAS YOU'RE USING
//Remove one of the other, depending on your DB preferences
//Or keep them both for simultaneous sync of 2 separate DBs
const schemas = [];
if (process.env.SQL_SERVER)
  schemas.push({
    method: "sequelize",
    model: SchemaMsSql,
    tableDef: tableDef,
    name: "AccountSequelize",
  });

//If there is a MongoDB connection string
if (process.env.MONGODB)
  schemas.push({
    method: "mongoDb",
    model: SchemaMongo,
    name: "AccountMongoDb",
  });

// Call this function when your app starts to ensure the table is created
//IF USING SEQUELIZE CREATE THE DATABASE TABLE PRIOR TO ANY DATABASE OPERATIONS
(async () => {
  if (tableDef && process.env.SQL_SERVER) {
    try {
      await createTableIfNotExists(tableDef, "Accounts");
    } catch (error) {
      console.error("Failed to create table from model:", error);
    }
  }
})();


const hashPassword = (password, salt) => {
  return crypto.scryptSync(password, salt, 64).toString('hex');
};

const verifyPassword = (password, salt, hashedPassword) => {
  const hashed = hashPassword(password, salt);
  return hashed === hashedPassword;
};


//###############################
//Controller Endpoints Below
//###############################

// Accepts a new account and saves it to the database
exports.bootstrapAdminAccount = async function (req, res, next) {
  try {
    //Create Admin Password
    const plainPassword = "strongAdminPassword" + uuidv4();
    const passwordResetToken =
      uuidv4() + " " + uuidv4() + " " + uuidv4() + " " + uuidv4();


    const salt = crypto.randomBytes(16).toString('hex');
    const hashedPassword = hashPassword(plainPassword, salt);
    const hashedPasswordResetToken = hashPassword(passwordResetToken, salt);

    //Make a new admin account
    const newAccount = {
      uuid: uuidv4(),
      username: "osailAdmin",
      email: "admin@osail-liaso.com",
      useCase: "Administrator",
      notes: "Default administrator account",
      preferredLng: "en",
      roles: ["admin", "user"],
      status: "active",
      subscriptionStatus: "active",
      password: hashedPassword,
      salt,
      passwordResetToken: hashedPasswordResetToken,
    };

    let validatedJson = validateAgainstSchema(AccountSchemaJoi, newAccount);
    if (!validatedJson.error) {
      performDatabaseOperation({
        operation: "create",
        methods: createMethodsArray([validatedJson.value], null, schemas),
      })
        .then(() => {
          res.status(201).send({
            message:
              "Bootstrap initiated to create an admin account. Record this password, it is the last time it will be shown",
            payload: {
              username: newAccount.username,
              password: plainPassword,
              passwordResetToken: passwordResetToken,
            },
          });
        })
        .catch((err) => {
          res.status(400).json({ message: "Query error", payload: err });
        });
    } else {
      res
        .status(400)
        .json({ message: "Validation error", payload: validatedJson.error });
    }
  } catch (error) {
    console.error("Bootstrap error:", error);
    res.status(500).json({ message: "failure", payload: error.message });
  }
};

//Create a single new account based on the user form
exports.createNewAccount = async function (req, res, next) {
  const { username, password, password2, email, useCase, notes, preferredLng } =
    req.body;

  if (!username) {
    return res.status(400).json({ message: "noUsername", payload: null });
  }

  let existingAccounts = await performDatabaseOperation({
    operation: "readOne",
    methods: createMethodsArray(null, { username: username }, schemas),
  });
  if (existingAccounts.length) {
    return res
      .status(400)
      .json({ message: "Username already exists", payload: null });
  }

  if (!password || password.length < 8 || password !== password2) {
    return res
      .status(400)
      .json({ message: "passwordsDontMatch", payload: null });
  }

  //Create the cryptographic fields
  const passwordResetToken =
    uuidv4() + " " + uuidv4() + " " + uuidv4() + " " + uuidv4();
  const salt = crypto.randomBytes(16).toString('hex');
  const hashedPassword = hashPassword(password, salt);
  const hashedPasswordResetToken = hashPassword(passwordResetToken, salt);

  const newAccount = {
    uuid: uuidv4(),
    username,
    email,
    useCase,
    notes,
    preferredLng: preferredLng || "en",
    roles: ["user"],
    status: "active",
    salt,
    password: hashedPassword,
    passwordResetToken: hashedPasswordResetToken,
    momentCreated: new Date(),
  };

  try {
    let validatedJson = validateAgainstSchema(AccountSchemaJoi, newAccount);
    if (!validatedJson.error) {
      performDatabaseOperation({
        operation: "create",
        methods: createMethodsArray([validatedJson.value], null, schemas),
      })
        .then((createdAccounts) => {
          const newToken = createJWT(newAccount, req.fullUrl);
          res.header("auth-token", newToken.token);
          res.header(
            "auth-token-decoded",
            JSON.stringify(newToken.tokenDecoded)
          );

          res.status(201).send({
            message:
              "Account created, and auth token returned in the request header. Note down the password reset token. Proceed to dashboard.",
            payload: {
              username: newAccount.username,
              passwordResetToken: passwordResetToken,
            },
          });
        })
        .catch((err) => {
          res.status(400).json({ message: "Query error", payload: err });
        });
    } else {
      res
        .status(400)
        .json({ message: "Validation error", payload: validatedJson.error });
    }
  } catch (error) {
    res.status(500).json({ message: "failure", payload: null });
  }
};

exports.login = async function (req, res, next) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      throw ApiError.badRequest("Username and password are required.");
    }

    let account = null;
    let accounts = await performDatabaseOperation({
      operation: "readMany",
      methods: createMethodsArray(null, { username: username }, schemas),
    });

    if (accounts.length) account = accounts[0];

    if (!account) {
      throw ApiError.notFound("Account not found.");
    }

    const passwordMatch = verifyPassword(password, account.salt, account.password);
    if (!passwordMatch) {
      throw ApiError.unauthorized("Incorrect password.");
    }

    
    const tokenInfo = {
      uuid: account.uuid,
      username: account.username,
      roles: account.roles,
      status: account.status,
    };
    const newToken = createJWT(tokenInfo, "login");
    res.header("auth-token", newToken.token);
    res.header("auth-token-decoded", JSON.stringify(newToken.tokenDecoded));
    res
      .status(200)
      .json({ message: "Login successful", payload: {token:newToken.token, tokenDecoded:newToken.tokenDecoded} });
  } catch (error) {
    next(error);
  }
};
exports.resetPassword = async function (req, res, next) {
  try {
    // Username, new password, and reset token
    let username = req.body.username;
    let newPassword = req.body.newPassword;
    let passwordResetToken = req.body.passwordResetToken;

    if (!username || !newPassword || !passwordResetToken) {
      throw ApiError.notFound("Missing username, new password, or password reset token");
    }

    let accounts = await performDatabaseOperation({
      operation: "readOne",
      methods: createMethodsArray(null, { username: username }, schemas),
    });

    if (!accounts.length) {
        throw ApiError.notFound("Account not found.");
    }

    let account = accounts[0];
    const passwordResetTokensMatch = verifyPassword(passwordResetToken, account.salt, account.passwordResetToken);
    if (!passwordResetTokensMatch) {
      throw ApiError.notFound("Password reset token does not match. Please contact your administrator for a manual reset");
    }

    // Proceed with the reset
    // Make new token, salt
    const newPasswordResetToken = uuidv4() + " " + uuidv4() + " " + uuidv4() + " " + uuidv4();
    const newSalt = crypto.randomBytes(16).toString('hex');
    const newHashedPassword = hashPassword(plainPassword, salt);
    const newHashedPasswordResetToken = hashPassword(passwordResetToken, salt);

    //Update the account
    account.salt = newSalt;
    account.password = newHashedPassword;
    account.passwordResetToken = newHashedPasswordResetToken;

    //Perform the DB update
    await performDatabaseOperation({
      operation: "update",
      methods: createMethodsArray(account, { username: username }, schemas),
    });

    //Send the response
    res.status(200).json({
      message: "Password updated. A new reset token has been provided for future use.",
      payload: { passwordResetToken: newPasswordResetToken },
    });
  } catch (error) {
    console.error("Error attempting password reset:", error);
    res.status(500).json({
      message: "Error attempting password reset",
      payload: error.message,
    });
  }
};


exports.getAccounts = async function (req, res, next) {};

exports.accountOwn = async function (req, res, next) {};

exports.accountOwnUpdate = async function (req, res, next) {};

exports.accountOwnDelete = async function (req, res, next) {
  let username = req?.tokenDecoded?.username;
  if (username) {
    let deleteAccount = await performDatabaseOperation({
      operation: "delete",
      methods: createMethodsArray(null, { username: username }, schemas),
    });
    res
      .status(200)
      .json({ message: "Test Delete", accountsDeleted: deleteAccount });
  }
};

// ... (keep other functions like accountOwnDataDownload, accountOwnDataUpload, accountOwnDataDelete as they are)

exports.allAccountInfo = async function (req, res, next) {};

exports.deleteAccounts = async function (req, res, next) {};
