import logger from "./../logger";
import { Client, User } from "tetr.js";
import { helpMessage } from "./../exports";

module.exports = async function () {
  if (!process.env.TETRIO_TOKEN)
    return logger.error("No TETR.IO token provided.");

  process.on("message", (message: { command: string; data: any }) => {
    switch (message.command) {
      case "newRoom":
        newRoom(message.data.roomID, message.data.author);
        break;

      default:
        break;
    }
  });

  async function newRoom(roomID: string, authorID: string) {
    if (!process.env.TETRIO_TOKEN)
      return logger.error("No TETR.IO token provided.");

    const client = new Client();

    client.on("ready", async () => {
      const author = await client.users?.fetch(authorID);
      if (!client.user || !author)
        return logger.error("ClientUser or author doesn't exist");

      let join = false;

      client.on("err", ({ fatal, reason }) => {
        logger.warn(reason);

        !fatal && client.disconnect();
        author.send("An error occurred");
      });

      client.user.join(roomID);

      client.user.on("join", async () => {
        if (!client.user || !client.user.room)
          return logger.error("ClientUser or Room doesn't exist");

        join = true;

        client.user.room.send(helpMessage);

        client.user.room.on("message", ({ content, author, system }) => {
          if (system || !author || author.role == "bot") return;

          if (!content.startsWith("-")) return;

          const args = content.trim().split(" ");
          const command = args.shift()?.toLowerCase().slice(1);

          switch (command) {
            case "help":
              client.user?.room?.send(helpMessage);
              break;

            default:
              break;
          }
        });

        client.user.room.on("leave", () => {
          if (
            !client.user?.room?.players ||
            client.user?.room?.players.length < 2
          ) {
            if (process.send) process.send({ command: "removeHost" });

            client.user?.leave();
            client.disconnect();
          }
        });
      });
    });

    client.login(process.env.TETRIO_TOKEN);
  }
};
