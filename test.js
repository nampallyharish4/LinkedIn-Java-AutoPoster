const axios = require('axios');
require('dotenv').config({ path: __dirname + '/.env' });

async function test() {
  console.log("Key is:", process.env.GROQ_API_KEY);
  try {
    const res = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: 'Hello' }]
      },
      { 
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
        } 
      }
    );
    console.log("SUCCESS");
    console.log(res.data.choices[0].message.content);
  } catch (err) {
    console.log("ERROR:", err.response?.data || err.message);
  }
}
test();
