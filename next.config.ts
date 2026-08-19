import type { NextConfig } from 'next'

// Product images are served from the R2 bucket's public URL, which differs per environment, so
// the pattern is derived from the env rather than hard-coded. Empty when R2 is unconfigured —
// next/image then refuses the host, which is the right answer for that deployment.
const r2PublicUrl = process.env.R2_PUBLIC_URL

const nextConfig: NextConfig = {
  images: {
    remotePatterns: r2PublicUrl ? [new URL(`${r2PublicUrl.replace(/\/$/, '')}/**`)] : [],
  },
}

export default nextConfig
