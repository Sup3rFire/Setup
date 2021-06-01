import logger from "./../logger";
import { Client } from "tetr.js";
import { helpMessage } from "./../exports";

module.exports = async function () {
  if (!process.env.TETRIO_TOKEN)
    return logger.error("No TETR.IO token provided.");

  process.on("message", (message: { command: string; data: any }) => {
    switch (message.command) {
      case "newRoom":
        newRoom(message.data.roomID);
        break;

      default:
        break;
    }
  });

  async function newRoom(roomID: string) {
    if (!process.env.TETRIO_TOKEN)
      return logger.error("No TETR.IO token provided.");

    const client = new Client();

    client.on("ready", async () => {
      if (!client.user) return logger.error("ClientUser doesn't exist");

      client.user.join(roomID);

      client.user.on("join", async () => {
        if (!client.user || !client.user.room)
          return logger.error("ClientUser or Room doesn't exist");

        client.user.room.send(
          [
            "Hello, I am Setup! The bot to load and save room setups!",
            "",
            "To view my commands, do -help",
            "To start using me, invite me to a room",
          ].join("\n")
        );

        client.user.room.on("message", ({ content, author, system }) => {
          if (system || !author || author.role == "bot") return;

          if (!content.startsWith("-")) return;

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
    });

    client.login(process.env.TETRIO_TOKEN);
  }
};
