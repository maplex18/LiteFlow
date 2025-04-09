/** @type {import('lite').liteConfig} */
const liteConfig = {
  output: 'standalone',
  env: {
    DB_HOST: process.env.DB_HOST,
    DB_USER: process.env.DB_USER,
    DB_PASSWORD: process.env.DB_PASSWORD,
    DB_NAME: process.env.DB_NAME,
    DB_PORT: process.env.DB_PORT,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    BASE_URL: process.env.BASE_URL,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_ORG_ID: process.env.OPENAI_ORG_ID,
    // AZURE_URL: process.env.AZURE_URL,
    // AZURE_API_KEY: process.env.AZURE_API_KEY,
    // AZURE_API_VERSION: process.env.AZURE_API_VERSION,
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
    GOOGLE_URL: process.env.GOOGLE_URL,
    GOOGLE_API_VERSION: process.env.GOOGLE_API_VERSION,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    ANTHROPIC_API_VERSION: process.env.ANTHROPIC_API_VERSION,
    ANTHROPIC_URL: process.env.ANTHROPIC_URL,
    // BAIDU_API_KEY: process.env.BAIDU_API_KEY,
    // BAIDU_SECRET_KEY: process.env.BAIDU_SECRET_KEY,
    // BAIDU_URL: process.env.BAIDU_URL,
    BYTEDANCE_API_KEY: process.env.BYTEDANCE_API_KEY,
    BYTEDANCE_URL: process.env.BYTEDANCE_URL,
    // ALIBABA_API_KEY: process.env.ALIBABA_API_KEY,
    // ALIBABA_URL: process.env.ALIBABA_URL,
    TENCENT_API_KEY: process.env.TENCENT_API_KEY,
    TENCENT_URL: process.env.TENCENT_URL,
    MOONSHOT_API_KEY: process.env.MOONSHOT_API_KEY,
    MOONSHOT_URL: process.env.MOONSHOT_URL,
    IFLYTEK_API_KEY: process.env.IFLYTEK_API_KEY,
    IFLYTEK_API_SECRET: process.env.IFLYTEK_API_SECRET,
    IFLYTEK_URL: process.env.IFLYTEK_URL,
    XAI_API_KEY: process.env.XAI_API_KEY,
    XAI_URL: process.env.XAI_URL,
    CHATGLM_API_KEY: process.env.CHATGLM_API_KEY,
    CHATGLM_URL: process.env.CHATGLM_URL,
  },
  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack']
    });
    return config;
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,DELETE,PATCH,POST,PUT" },
          { key: "Access-Control-Allow-Headers", value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization" },
        ]
      },
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,DELETE,PATCH,POST,PUT" },
          { key: "Access-Control-Allow-Headers", value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization" },
        ]
      }
    ]
  },
  server: {
    port: 80,
    host: '0.0.0.0'
  }
}

module.exports = liteConfig 