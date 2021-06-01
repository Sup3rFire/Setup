require("dotenv").config();

import cluster from "cluster";
import logger from "./logger";

import { servers } from "./exports";

let currentServers: {
  name: string;
  pid: number;
  id: number;
  hosting: number;
}[] = [];

export function curSrv(id?: number, hosting?: number) {
  if (!!id && !!hosting) {
    let server = currentServers.find((server) => server.id == id);
    if (!!server) server.hosting += hosting;
  } else return currentServers;
}

if (cluster.isMaster) {
  require("./Master/index")();

  const numCPUs = process.env.DEBUG_CPUS || require("os").cpus().length;
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on("online", async (server) => {
    const name =
      servers.find(
        (name) => !currentServers.map((sv) => sv.name).includes(name)
      ) || "Kagari";

    currentServers.push({
      name,
      pid: server.process.pid,
      id: server.id,
      hosting: 0,
    });
    server.send({ command: "setup", name });
  });

  cluster.on("exit", async (server) => {
    const getServer = currentServers.find((sv) => sv.pid == server.process.pid);
    if (!getServer)
      return logger.info("An unlisted server died, but wasn't listed");

    const serverDied = currentServers.splice(
      currentServers.indexOf(getServer),
      1
    );

    logger.info(`${serverDied[0].name} died, reviving`);

    cluster.fork();
  });
} else {
  const awaitSetup = async (m: { command: string; name: string }) => {
    if (m.command != "setup") return;

    const name = m.name;

    logger.info(`${name} online`);

    process.removeListener("message", awaitSetup);
    require(`./TETR.IO/index`)(name);
  };

  process.on("message", awaitSetup);
}
