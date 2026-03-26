const { PrismaClient } = require("@prisma/client");

const globalKey = "__openwa_prisma__";

if (!global[globalKey]) {
  global[globalKey] = new PrismaClient();
}

module.exports = {
  prisma: global[globalKey]
};
