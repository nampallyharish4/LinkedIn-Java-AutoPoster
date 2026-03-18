require('dotenv').config();

module.exports = {
  groq: {
    apiKey: process.env.GROQ_API_KEY,
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
    endpoint: 'https://api.groq.com/openai/v1/chat/completions'
  },
  linkedin: {
    clientId: process.env.LINKEDIN_CLIENT_ID,
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
    accessToken: process.env.LINKEDIN_ACCESS_TOKEN,
    personUrn: process.env.LINKEDIN_PERSON_URN
  },
  server: {
    port: parseInt(process.env.PORT) || 3000
  },
  schedule: {
    postTime: process.env.POST_TIME || '09:00',
    timezone: process.env.TIMEZONE || 'Asia/Kolkata'
  }
};
