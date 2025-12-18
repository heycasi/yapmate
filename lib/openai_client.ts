import OpenAI from 'openai'

const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY

if (!apiKey) {
  console.warn('Missing NEXT_PUBLIC_OPENAI_API_KEY environment variable. AI features will fail.')
}

export const openaiClient = new OpenAI({
  apiKey: apiKey || 'dummy-key',
  dangerouslyAllowBrowser: true,
})
