import logger from "./../logger";
import { Client, User } from "tetr.js";
import { nanoid } from "nanoid";
import { helpMessage } from "./../exports";

module.exports = async function () {
  if (!process.env.TETRIO_TOKEN)
    return logger.error("No TETR.IO token provided.");

  let availableClient: Client | undefined;

  let setupClient: Client | undefined = new Client();
  setupClient.login(process.env.TETRIO_TOKEN);

  setupClient.once("ready", async () => {
    availableClient = setupClient;
    setupClient = undefined;
  });

  process.on("message", (message: { command: string; data: any }) => {
    if (!process.env.TETRIO_TOKEN)
      return logger.error("No TETR.IO token provided.");

    switch (message.command) {
      case "newRoom":
        logger.info(
          `Starting a new client for ${message.data.author} in #${message.data.roomID}`
        );

        if (!availableClient) {
          let newClient = new Client();
          newClient.login(process.env.TETRIO_TOKEN);

          newClient.once("ready", async () => {
            newRoom(newClient, message.data.roomID, message.data.author);
          });
        } else {
          newRoom(availableClient, message.data.roomID, message.data.author);
          let setupClient: Client | undefined = new Client();
          setupClient.login(process.env.TETRIO_TOKEN);

          setupClient.once("ready", async () => {
            availableClient = setupClient;
            setupClient = undefined;
          });
        }
        break;

      default:
        break;
    }
  });

  async function newRoom(client: Client, roomID: string, authorID: string) {
    if (!process.env.TETRIO_TOKEN)
      return logger.error("No TETR.IO token provided.");

    const cooldowns = new Map();

    const author = await client.users?.fetch(authorID);
    if (!client.user || !author)
      return logger.error("ClientUser or author doesn't exist");

    let join = false;
    let loadingConfig = false;
    let roomHost: User;

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
      roomHost = client.user.room.owner;

      client.user.room.send(helpMessage);

      let loaded: false | string = false;

      client.user.room.on("message", ({ content, author, system }) => {
        if (system || !author || author.role == "bot") return;

        const now = Date.now();
        const cooldownAmount = 3 * 1000;

        if (cooldowns.has(author._id)) {
          const expirationTime = cooldowns.get(author._id) + cooldownAmount;

          if (now < expirationTime) {
            const timeLeft = (expirationTime - now) / 1000;
            return client.user?.room?.send(
              `please wait ${timeLeft.toFixed(
                1
              )} more second(s) before using a command.`
            );
          }
        }

        cooldowns.set(author._id, now);

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

              const awaitReply = async (m: { command: string; data: any }) => {
                if (m.data.id !== id) return;
                process.removeListener("message", awaitReply);

                if (m.data.err) {
                  logger.error(m.data.err);
                  return client.user?.room?.send(
                    "There was an error while trying to save your settings"
                  );
                }

                if (m.command == "forbidden")
                  return client.user?.room?.send(
                    "You aren't allowed to save to this room config"
                  );

                loaded = m.data.room._id;
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

              const awaitReply = async (m: { command: string; data: any }) => {
                if (m.data.id !== id) return;

                if (m.data.err) {
                  logger.error(m.data.err);
                  return client.user?.room?.send(
                    "There was an error while trying to save your settings"
                  );
                }

                if (m.command == "exists")
                  return client.user?.room?.send(
                    "A config with this name already exists"
                  );

                loaded = m.data.room._id;
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

            if (author._id != client.user?.room?.owner._id)
              return client.user?.room?.send(
                "You must be the owner of the room to load a setting"
              );

            let roomOwner = author._id;

            client.user?.room?.send("Loading this room config...");

            if (process.send && client.user && client.user.room) {
              const id = nanoid();

              process.send({
                command: "loadSetting",
                data: {
                  setting: args.join(" "),
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
                if (!m.data.setting)
                  return client.user?.room?.send(
                    "This room config doesn't exist"
                  );

                if (
                  !client.user?.room?.players.find(
                    (player) => player.user._id == roomOwner
                  )
                )
                  return;

                const configRaw = m.data.setting.config;

                let config: { index: string; value: any }[] = [];
                for (const meta in configRaw.meta) {
                  if (meta == "match") {
                    config.push({
                      index: "meta.match.ft",
                      value: configRaw.meta.match.ft,
                    });
                    config.push({
                      index: "meta.match.wb",
                      value: configRaw.meta.match.wb,
                    });
                  } else {
                    config.push({
                      index: `meta.${meta}`,
                      value: configRaw.meta[meta],
                    });
                  }
                }
                for (const options in configRaw.options) {
                  config.push({
                    index: `game.options.${options}`,
                    value: configRaw.options[options],
                  });
                }

                if (client.user.room.owner._id != client.user._id) {
                  loadingConfig = true;
                  client.user.room.send(
                    "Please give the bot host to finish loading this config"
                  );

                  const awaitHost = async (newHost: User) => {
                    if (newHost._id != client.user?._id) return;

                    client.user.room?.removeListener("host_switch", awaitHost);

                    client.user.room?.updateConfig(config);
                    client.user.room?.transferHost(author);
                    loadingConfig = false;
                    loaded = m.data.setting._id;
                  };

                  client.user.room.on("host_switch", awaitHost);
                } else {
                  loadingConfig = true;
                  client.user.room.updateConfig(config);
                  client.user.room.transferHost(author);
                  loadingConfig = false;
                  loaded = m.data.setting._id;
                }

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

          case "leave":
            if (author._id != client.user?.room?.owner._id)
              return client.user?.room?.send(
                "You must be the owner of the room to make the bot leave"
              );
            client.user?.leave();
            client.disconnect();
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

      client.user.room.on("host_switch", (host) => {
        if (host._id != client.user?._id) return (roomHost = host);
        if (loadingConfig) return;

        client.user.room?.transferHost(roomHost);
      });

      client.user.room.on("bracket_swap", ({ bracket, user }) => {
        if (bracket == "playing" && user._id == client.user?._id)
          client.user.room?.switchBracket("spectator");
      });
    });
  }
};
