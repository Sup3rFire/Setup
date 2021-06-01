import mongoose from "mongoose";
import logger from "./../logger";
import { Client } from "tetr.js";
import { helpMessage } from "./../exports";
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
      if (!client.user) return;

      client.user.on("message", ({ content, author, systemMessage }) => {
        if (systemMessage || !author || author.role == "bot") return;

        if (!content.startsWith("-"))
          return author.send(
            [
              "Hello, I am Setup! The bot to load and save room setups!",
              "",
              "To view my commands, do -help",
              "To start using me, invite me to a room",
            ].join("\n")
          );

        const args = content.trim().split(" ");
        const command = args.shift()?.toLowerCase().slice(1);

        switch (command) {
          case "help":
            author.send(helpMessage);
            break;

          default:
            break;
        }
      });
    });

    client.login(process.env.TETRIO_TOKEN);
  }
};
