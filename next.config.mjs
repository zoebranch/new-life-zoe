/** @type {import("next").NextConfig} */
const nextConfig = { distDir: process.env.ZOE_BUILD_DIR || ".next" };
export default nextConfig;
