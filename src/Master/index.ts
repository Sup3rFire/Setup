import logger from "./../logger";
import { Client } from "tetr.js";
import { helpMessage } from "./../exports";
import { curSrv } from "./../index";
import cluster from "cluster";

module.exports = async function () {
  tetrio();
  async function tetrio() {
    if (!process.env.TETRIO_TOKEN)
      return logger.error("No TETR.IO token provided.");

    const client = new Client();

    client.on("ready", async () => {
      logger.info("Master online");
      if (!client.user) return logger.error("ClientUser doesn't exist");

      client.user.on("message", ({ content, author, system }) => {
        if (system || !author || author.role == "bot") return;

        if (!content.startsWith("-")) return author.send(helpMessage);

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

      client.user.on("invite", ({ author, room }) => {
        author.send("Joining your room, please wait for a moment");
        const host = curSrv().sort((s1, s2) => s1.hosting - s2.hosting)[0];
        cluster.workers[host.id]?.send({
          command: "newRoom",
          data: { roomID: room.id, author: author._id },
        });
      });
    });

    client.login(process.env.TETRIO_TOKEN);
  }
};
