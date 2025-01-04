const jwt = require("jsonwebtoken");
const uuidv4 = require("uuid").v4;

// Middleware to verify if the user is authenticated
const isAuthenticated = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(" ")[1];
    jwt.verify(token, process.env.JWT_SECRET, (err, decodedToken) => {
      if (err) {
        return res.status(403).json({ message: "Invalid or expired token." });
      }
      req.tokenDecoded = decodedToken; // Assign the decoded token to req.tokenDecoded
      next();
    });
  } else {
    res.sendStatus(401);
  }
};

const authenticateAndDecode = (token) => {
    try {
      const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
      return decodedToken;
    } catch (err) {
      return false;
    }
  };

// Middleware to verify if the user is authenticated
// Allow the controller to tap into req.tokenDecoded to enable some additional functions
const decodeValidToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(" ")[1];
    jwt.verify(token, process.env.JWT_SECRET, (err, decodedToken) => {
      if (!err) {
        req.tokenDecoded = decodedToken; // Assign the decoded token to req.tokenDecoded
      }
      next();
    });
  } else {
    next();
  }
};

// Middleware to renew the token if it's about to expire
const renewToken = (req, res, next) => {
  const tokenDecoded = req.tokenDecoded;
  if (tokenDecoded) {
    const expirationDate = new Date(tokenDecoded.exp * 1000);
    const twentyMinutesFromNow = new Date(Date.now() + 20 * 60 * 1000);
    if (expirationDate < twentyMinutesFromNow) {
      const newToken = createJWT(tokenDecoded, "token-renewal");
      res.header("auth-token", newToken.token);
      res.header("auth-token-decoded", JSON.stringify(newToken.tokenDecoded));
    }
    next();
  } else {
    next(); // No user decoded, isAuthenticated middleware will handle it
  }
};

// Function to create JWT
function createJWT(account, source) {
  const tokenDecoded = {
    username: account.username,
    roles: account.roles,
    aud: "OSAIL-LIASO-NODE",
    iss: source,
    nbf: Math.floor(Date.now() / 1000),
    jti: uuidv4(),
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60, // one hour
  };
  const token = jwt.sign(tokenDecoded, process.env.JWT_SECRET);
  return { token, tokenDecoded };
}

// Middleware to check if the user is an admin
function isAdmin(req, res, next) {
  const roles = req.tokenDecoded?.roles || [];
  if (!roles.includes("admin")) {
    return res
      .status(403)
      .send({ message: "Access denied. Only admins can perform this action." });
  }
  next();
}
module.exports = {
  isAuthenticated,
  decodeValidToken,
  renewToken,
  createJWT,
  isAdmin,

  authenticateAndDecode,
};
