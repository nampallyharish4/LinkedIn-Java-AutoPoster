const axios = require('axios');
const config = require('../config/config');

// Java topics pool for diverse content generation
const JAVA_TOPICS = [
  'Java Streams API and functional programming',
  'Java design patterns (Singleton, Factory, Observer, Strategy)',
  'Java memory management and garbage collection',
  'Spring Boot microservices best practices',
  'Java concurrency and multithreading',
  'Java 21 new features and virtual threads',
  'JVM internals and performance tuning',
  'Java collections framework deep dive',
  'Java exception handling best practices',
  'Java generics and type erasure',
  'Java annotations and reflection',
  'Spring Security and OAuth2',
  'Java testing with JUnit 5 and Mockito',
  'Java record classes and sealed interfaces',
  'Reactive programming with Project Reactor',
  'Java module system (JPMS)',
  'Java pattern matching and switch expressions',
  'Docker and Kubernetes for Java developers',
  'Java database connectivity and JPA/Hibernate',
  'Event-driven architecture with Java and Kafka',
  'Java serialization and JSON processing',
  'Java networking and HTTP client API',
  'Clean code principles in Java',
  'Java build tools: Maven vs Gradle',
  'Java logging frameworks and best practices',
  'Microservices communication patterns in Java',
  'Java Optional and null safety',
  'CompletableFuture and async programming in Java',
  'Java text blocks and string templates',
  'GraphQL APIs with Spring Boot',
  'Java monitoring and observability',
  'SOLID principles in Java',
  'Java interview questions and tips',
  'Java career growth and learning paths',
  'Java performance optimization techniques',
  'Spring Data and repository patterns',
  'Java web security fundamentals',
  'CI/CD pipelines for Java projects',
  'Java code review best practices',
  'Legacy Java code modernization strategies'
];

// Post style variations
const POST_STYLES = [
  'tips_and_tricks',
  'code_snippet',
  'opinion_piece',
  'tutorial_highlight',
  'career_advice',
  'industry_trend',
  'problem_solution',
  'comparison',
  'myth_busting',
  'productivity_hack'
];

function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildPrompt(topic, style) {
  return `You are a senior Java developer and LinkedIn content creator with 15+ years of experience. 
Generate a compelling, engaging LinkedIn post about: "${topic}"

Post style: ${style.replace('_', ' ')}

RULES:
1. Start with a powerful hook (first line should grab attention — use bold statements, questions, or surprising facts)
2. Use short paragraphs (2-3 sentences max each)
3. Include relevant emojis but don't overdo it (3-5 total)
4. Add a code snippet ONLY if the style is "code_snippet" — wrap it in plain text formatting since LinkedIn doesn't support markdown code blocks
5. Include 1-2 actionable takeaways
6. End with a thought-provoking question to drive engagement
7. Add 3-5 relevant hashtags at the end (always include #Java and #SoftwareDevelopment)
8. Keep the total length between 800-1500 characters (LinkedIn optimal range)
9. Write in a conversational, authentic tone — not corporate/robotic
10. Do NOT use markdown formatting like ** or ## (LinkedIn doesn't render them) — use CAPS or line breaks for emphasis instead
11. Do NOT include any greeting like "Hey LinkedIn" or "Hello network"

Return ONLY the post content, nothing else. No explanations, no metadata.`;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function callGroqWithRetry(prompt, maxRetries = 3) {
  let lastError = null;
  // Iterate through available fallback models
  for (const model of config.groq.models) {
    console.log(`🤖 Attempting completion with model: ${model}`);
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await axios.post(
          config.groq.endpoint,
          {
            model: model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.9,
            top_p: 0.95,
            max_tokens: 1024
          },
          {
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${config.groq.apiKey}`
            },
            timeout: 30000
          }
        );
        return response;
      } catch (error) {
        lastError = error;
        const status = error.response?.status;
        const isRateLimit = status === 429 || status === 403;
        
        console.error(`❌ Model ${model} failed (Status: ${status}). Detail:`, error.response?.data ? JSON.stringify(error.response.data) : error.message);
        
        // If it's a rate limit or bad request, but we have quota issues, break inner loop to try the next model
        if (isRateLimit || status === 400) {
            console.log(`⚠️ Quota/Rate limit or model error for ${model}. Switching to next model...`);
            break; // Try next model immediately
        }

        // Retry other transient errors on the same model
        if (attempt < maxRetries) {
          const delay = attempt * 3000;
          console.log(`⏳ Transient error. Retrying in ${delay/1000}s... (attempt ${attempt}/${maxRetries})`);
          await sleep(delay);
          continue;
        }
      }
    }
  }
  throw lastError;
}

async function generatePost(customTopic = null) {
  const topic = customTopic || getRandomItem(JAVA_TOPICS);
  const style = getRandomItem(POST_STYLES);
  
  const prompt = buildPrompt(topic, style);

  try {
    const response = await callGroqWithRetry(prompt);

    const content = response.data?.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('No content generated from AI');
    }

    return {
      content: content.trim(),
      topic,
      style,
      generatedAt: new Date().toISOString()
    };
  } catch (error) {
    const status = error.response?.status;
    const apiMessage = error.response?.data?.error?.message || '';
    
    if (status === 429 || (status === 403 && apiMessage.includes('quota'))) {
      console.error('❌ Groq API quota exceeded after retries');
      throw new Error('Groq API rate limit exceeded. Please wait a minute and try again.');
    }
    
    console.error('❌ AI Generation Error:', error.message);
    throw new Error(`Failed to generate post: ${error.message}`);
  }
}

async function generatePreview(customTopic = null) {
  return await generatePost(customTopic);
}

module.exports = {
  generatePost,
  generatePreview,
  JAVA_TOPICS,
  POST_STYLES
};
