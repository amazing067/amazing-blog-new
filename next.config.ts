import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // sharp는 네이티브 모듈 — 서버 라우트에서 번들링하지 말고 런타임 require로.
  serverExternalPackages: ['sharp'],
};

export default nextConfig;
