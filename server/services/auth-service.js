const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { prisma } = require("../database/client");

function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt
  };
}

function issueToken(user, config) {
  return jwt.sign({ sub: user.id, email: user.email }, config.jwtSecret, {
    expiresIn: "7d"
  });
}

async function registerUser({ name, email, password, config }) {
  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (!name || !normalizedEmail || !password) {
    throw new Error("Name, email, and password are required.");
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail }
  });

  if (existingUser) {
    throw new Error("Email is already registered.");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      name: String(name).trim(),
      email: normalizedEmail,
      passwordHash
    }
  });

  return {
    token: issueToken(user, config),
    user: sanitizeUser(user)
  };
}

async function loginUser({ email, password, config }) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail }
  });

  if (!user) {
    throw new Error("Invalid email or password.");
  }

  const matches = await bcrypt.compare(password, user.passwordHash);
  if (!matches) {
    throw new Error("Invalid email or password.");
  }

  return {
    token: issueToken(user, config),
    user: sanitizeUser(user)
  };
}

async function getUserFromToken(token, config) {
  if (!token) {
    return null;
  }

  const payload = jwt.verify(token, config.jwtSecret);
  const user = await prisma.user.findUnique({
    where: { id: payload.sub }
  });

  return user ? sanitizeUser(user) : null;
}

function authMiddleware(config) {
  return async (req, res, next) => {
    try {
      const header = req.headers.authorization || "";
      const token = header.startsWith("Bearer ") ? header.slice(7) : null;

      if (!token) {
        return res.status(401).json({ error: "Authentication required." });
      }

      const user = await getUserFromToken(token, config);
      if (!user) {
        return res.status(401).json({ error: "Invalid token." });
      }

      req.user = user;
      return next();
    } catch (error) {
      return res.status(401).json({ error: error.message });
    }
  };
}

module.exports = {
  authMiddleware,
  getUserFromToken,
  loginUser,
  registerUser,
  sanitizeUser
};
