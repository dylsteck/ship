import { defineCloudflareConfig } from '@opennextjs/cloudflare'

const config = defineCloudflareConfig()
config.default.minify = true

export default config
