require("dotenv").config();

import cluster from "cluster";
import logger from "./logger";

import { servers } from "./exports";

if (cluster.isMaster) {
  const currentServers: { name: string; id: number; type: string }[] = [];

  const numCPUs = process.env.DEBUG_CPUS || require("os").cpus().length;
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on("online", async (server) => {
    const name =
      servers.find(
        (name) => !currentServers.map((sv) => sv.name).includes(name)
      ) || "Kagari";

    const type = currentServers.find((sv) => sv.type == "Discord")
      ? "TETR.IO"
      : "Discord";

    currentServers.push({ name, id: server.process.pid, type });
    server.send({ command: "setup", name, type });
  });

  cluster.on("exit", async (server) => {
    const getServer = currentServers.find((sv) => sv.id == server.process.pid);
    if (!getServer)
      return logger.info("An unlisted server died, but wasn't listed");

    const serverDied = currentServers.splice(
      currentServers.indexOf(getServer),
      1
    );

    logger.info(`${serverDied[0].type} ${serverDied[0].name} died, reviving`);

    cluster.fork();
  });
} else {
  require("mongoose").connect(process.env.MONGO_CONNECTION, {
    useNewUrlParser: true,
    useFindAndModify: false,
    useUnifiedTopology: true,
  });

  const cachegoose = require("recachegoose");
  cachegoose(require("mongoose"), {
    engine: "file",
  });

  require("mongoose").set("useCreateIndex", true);

  const awaitSetup = async (m: {
    command: string;
    name: string;
    type: string;
  }) => {
    if (m.command != "setup") return;

    const name = m.name;

    logger.info(`${m.type} server ${name} online.`);

    process.removeListener("message", awaitSetup);

    require(`./${m.type}/index.js`)(name);
  };

  process.on("message", awaitSetup);
}
