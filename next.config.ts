import type { NextConfig } from "next";
import { readEnvironment } from "./src/config/env";

readEnvironment(process.env);

const config: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
};

export default config;
