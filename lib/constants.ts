// Rate limiting configuration
export const MAX_MESSAGES_PER_DAY = parseInt(process.env.MAX_MESSAGES_PER_DAY || '50', 10)

// Sandbox configuration (in minutes)
export const MAX_SANDBOX_DURATION = parseInt(process.env.MAX_SANDBOX_DURATION || '300', 10)
