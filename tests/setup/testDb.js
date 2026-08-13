const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");

// Each integration test file gets its own isolated in-memory MongoDB
// instance rather than one shared globally — slower to boot per-file, but
// avoids test files stepping on each other's data and lets them run in
// parallel safely if --runInBand is ever dropped.
async function startTestDb() {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  return {
    async clear() {
      const collections = mongoose.connection.collections;
      for (const key in collections) {
        await collections[key].deleteMany({});
      }
    },
    async stop() {
      await mongoose.disconnect();
      await mongod.stop();
    },
  };
}

module.exports = { startTestDb };
