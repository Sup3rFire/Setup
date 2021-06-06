require("dotenv").config();

import cluster, { settings } from "cluster";
import mongoose from "mongoose";
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
    const server = currentServers.find((server) => server.id == id);
    if (!!server) server.hosting += hosting;
    return currentServers;
  } else return currentServers;
}

if (cluster.isMaster) {
  require("./Master/index")();

  const settingsSchema = new mongoose.Schema({
    config: {
      meta: {
        name: String,
        userlimit: String,
        allowAnonymous: Boolean,
        bgm: String,
        match: { ft: Number, wb: Number },
      },
      options: {
        stock: Number,
        bagtype: String,
        spinbonuses: String,
        allow180: Boolean,
        kickset: String,
        allow_harddrop: Boolean,
        display_next: Boolean,
        display_hold: Boolean,
        nextcount: Number,
        display_shadow: Boolean,
        are: Number,
        lineclear_are: Number,
        room_handling: Boolean,
        room_handling_arr: Number,
        room_handling_das: Number,
        room_handling_sdf: Number,
        g: Number,
        gincrease: Number,
        gmargin: Number,
        garbagemultiplier: Number,
        garbagemargin: Number,
        garbageincrease: Number,
        locktime: Number,
        garbagespeed: Number,
        garbagecap: Number,
        garbagecapincrease: Number,
        garbagecapmax: Number,
        manual_allowed: Boolean,
        b2bchaining: Boolean,
        clutch: Boolean,
      },
    },
    name: String,
    owner: String,
  });

  const Settings = mongoose.model("Settings", settingsSchema);

  const numCPUs = require("os").cpus().length;
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

    if (!process.env.MONGO_CONNECTION)
      return logger.error("No mongo connection provided.");
    mongoose.connect(process.env.MONGO_CONNECTION, {
      useNewUrlParser: true,
      useFindAndModify: false,
      useUnifiedTopology: true,
    });

    server.send({ command: "setup", name });

    server.on("message", (msg: { command: string; data: any }) => {
      switch (msg.command) {
        case "removeHost":
          let sv = currentServers.find((sv) => sv.id == server.id);
          if (sv) sv.hosting -= 1;
          break;
        case "saveSettings":
          Settings.findById(msg.data._id, (err: any, settings: any) => {
            if (err)
              return server.send({
                command: "error",
                data: { id: msg.data.id, err },
              });

            if (!settings) {
              Settings.findOne(
                {
                  name: msg.data.config.meta.name.toLowerCase(),
                  owner: msg.data.owner,
                },
                (err: any, s: any) => {
                  if (err)
                    return server.send({
                      command: "error",
                      data: { id: msg.data.id, err },
                    });
                  if (!!s)
                    return server.send({
                      command: "exists",
                      data: { id: msg.data.id },
                    });

                  let setting = new Settings();
                  setting.config = msg.data.config;
                  setting.owner = msg.data.owner;
                  setting.name = msg.data.config.meta.name.toLowerCase();

                  setting.save((err: any, room: any) => {
                    server.send({
                      command: "newSetting",
                      data: { id: msg.data.id, err, room },
                    });
                  });
                }
              );
            } else {
              if (settings.owner != msg.data.owner)
                return server.send({
                  command: "forbidden",
                  data: { id: msg.data.id },
                });
              Settings.findByIdAndUpdate(
                msg.data._id,
                {
                  config: msg.data.config,
                  name: msg.data.config.meta.name.toLowerCase(),
                },
                (err: any, room: any) => {
                  server.send({
                    command: "saveSetting",
                    data: { id: msg.data.id, err, room },
                  });
                }
              );
            }
          });
          break;
        case "listSettings":
          Settings.find({ owner: msg.data.owner }, (err, settings) => {
            server.send({
              data: {
                id: msg.data.id,
                err,
                settings: !!settings
                  ? settings
                      .map((s) => `${s.config.meta.name} (ID: ${s._id})`)
                      .join(", ")
                  : undefined,
              },
            });
          });
          break;
        case "loadSetting":
          if (mongoose.Types.ObjectId.isValid(msg.data.setting)) {
            Settings.findById(msg.data.setting, (err: any, setting: any) => {
              server.send({
                data: {
                  id: msg.data.id,
                  err,
                  setting,
                },
              });
            });
          } else {
            Settings.findOne(
              { name: msg.data.setting, owner: msg.data.owner },
              (err: any, setting: any) => {
                server.send({
                  data: {
                    id: msg.data.id,
                    err,
                    setting,
                  },
                });
              }
            );
          }
          break;

        default:
          break;
      }
    });
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
