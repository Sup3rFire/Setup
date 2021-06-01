import mongoose from "mongoose";
import logger from "./../logger";
import { Client } from "tetr.js";
import { curSrv } from "./../index";

module.exports = async function () {
  if (!process.env.MONGO_CONNECTION)
    return logger.error("No mongo connection provided.");
  mongoose.connect(process.env.MONGO_CONNECTION, {
    useNewUrlParser: true,
    useFindAndModify: false,
    useUnifiedTopology: true,
  });
  const cachegoose = require("recachegoose");
  cachegoose(mongoose, {
    engine: "file",
  });

  tetrio();
  async function tetrio() {
    if (!process.env.TETRIO_TOKEN)
      return logger.error("No TETR.IO token provided.");

    const client = new Client();

    client.on("ready", async () => {
      if (client.user) {
      }
    });

    client.login(process.env.TETRIO_TOKEN);
  }
};
