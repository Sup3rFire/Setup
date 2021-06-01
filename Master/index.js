const mongoose = require("mongoose");
const logger = require("../logger");
const { Client } = require("tetr.js");
const { curSrv } = require("../index");

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
      client.user.on("message", (content, author, system) => {
        if (system || author.role == "bot") return;

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
        const command = args.shift().toLowerCase().slice(1);

        switch (command) {
          case "help":
            author.send(
              [
                "Global Commands",
                "-help - To view all commands",
                "",
                "Room Commands",
                "-save [Setup Name] - Save room setup",
                "-load (Setup Name / ID) - Load a room setup",
                "-leave - Makes the bot leave the room",
              ].join("\n")
            );
            break;

          default:
            break;
        }
      });
    });

    client.login(process.env.TETRIO_TOKEN);
  }
};
