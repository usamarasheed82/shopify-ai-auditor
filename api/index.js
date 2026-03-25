import * as build from "../build/server/index.js";
import { createRequestHandler } from "@remix-run/express";
import express from "express";

const app = express();

app.use(
  "/build",
  express.static("build/client", { immutable: true, maxAge: "1y" })
);
app.use(express.static("build/client"));
app.all("*", createRequestHandler({ build }));

export default app;
