import logger from "./../logger";
import { Client, User } from "tetr.js";
import { nanoid } from "nanoid";
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

        !join && author.send("An error occurred");
        if (process.send) process.send({ command: "removeHost" });
        !fatal && client.disconnect();
      });

      client.user.join(roomID);

      client.user.on("join", async () => {
        if (!client.user || !client.user.room)
          return logger.error("ClientUser or Room doesn't exist");

        join = true;

        client.user.room.send(helpMessage);

        let loaded: false | string = false;

        client.user.room.on("message", ({ content, author, system }) => {
          if (system || !author || author.role == "bot") return;

          if (!content.startsWith("-")) return;

          const args = content.trim().split(" ");
          const command = args.shift()?.toLowerCase().slice(1);

          switch (command) {
            case "help":
              client.user?.room?.send(helpMessage);
              break;
            case "save":
              if (author.role == "anon")
                return client.user?.room?.send(
                  "Please login to save room configs"
                );

              client.user?.room?.send("Saving your settings...");

              if (!!loaded) {
                const id = nanoid();
                if (process.send)
                  process.send({
                    command: "saveSettings",
                    data: {
                      _id: loaded,
                      id,
                      config: client.user?.room?.config,
                      owner: author._id,
                    },
                  });

                const awaitReply = async (m: {
                  command: string;
                  data: any;
                }) => {
                  if (m.data.id !== id) return;
                  process.removeListener("message", awaitReply);

                  if (m.data.err) {
                    logger.error(m.data.err);
                    return client.user?.room?.send(
                      "There was an error while trying to save your settings"
                    );
                  }

                  if (m.data.command == "forbidden")
                    return client.user?.room?.send(
                      "You aren't allowed to save to this room config"
                    );

                  client.user?.room?.send("Saved your settings");
                };

                process.on("message", awaitReply);
              } else {
                const id = nanoid();
                if (process.send)
                  process.send({
                    command: "saveSettings",
                    data: {
                      id,
                      config: client.user?.room?.config,
                      owner: author._id,
                    },
                  });

                const awaitReply = async (m: {
                  command: string;
                  data: any;
                }) => {
                  if (m.data.id !== id) return;

                  if (m.data.err) {
                    logger.error(m.data.err);
                    return client.user?.room?.send(
                      "There was an error while trying to save your settings"
                    );
                  }

                  if (m.data.command == "exists")
                    return client.user?.room?.send(
                      "A config with this name already exists"
                    );

                  client.user?.room?.send("Saved your settings");

                  process.removeListener("message", awaitReply);
                };

                process.on("message", awaitReply);
              }
              break;
            case "load":
              if (!args[0])
                return client.user?.room?.send(
                  "Please input a config name or a config id"
                );

              client.user?.room?.send("Loading this room config...");

              if (process.send && client.user && client.user.room) {
                const id = nanoid();

                process.send({
                  command: "loadSetting",
                  data: {
                    setting: args[0],
                    id,
                    owner: author._id,
                  },
                });

                const awaitReply = async (m: {
                  command: string;
                  data: any;
                }) => {
                  if (m.data.id !== id) return;

                  if (m.data.err) {
                    logger.error(m.data.err);
                    return client.user?.room?.send(
                      "There was an error while trying to find your saved settings"
                    );
                  }

                  //TODO: Actually set the config

                  process.removeListener("message", awaitReply);
                };

                process.on("message", awaitReply);
              }
              break;

            case "list":
              client.user?.room?.send("Finding your rooms...");

              const id = nanoid();

              if (process.send)
                process.send({
                  command: "listSettings",
                  data: {
                    id,
                    owner: author._id,
                  },
                });

              const awaitReply = async (m: { command: string; data: any }) => {
                if (m.data.id !== id) return;

                if (m.data.err) {
                  logger.error(m.data.err);
                  return client.user?.room?.send(
                    "There was an error while trying to find your saved settings"
                  );
                }

                client.user?.room?.send(`Your settings are ${m.data.settings}`);

                process.removeListener("message", awaitReply);
              };

              process.on("message", awaitReply);
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
