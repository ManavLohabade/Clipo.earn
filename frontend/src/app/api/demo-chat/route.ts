import { groq } from '@ai-sdk/groq';
import {
  convertToModelMessages,
  smoothStream,
  stepCountIs,
  streamText,
  type UIMessage,
} from 'ai';

export const maxDuration = 30;
export const revalidate = false;

export async function POST(req: Request) {
  try {
    const { messages }: { messages: UIMessage[] } = await req.json();

    const result = streamText({
      model: groq('meta-llama/llama-4-scout-17b-16e-instruct'),
      messages: await convertToModelMessages(messages),
      maxRetries: 3,
      stopWhen: stepCountIs(6),
      experimental_transform: smoothStream({
        chunking: 'word',
      }),
    });
    return result.toUIMessageStreamResponse({
      sendReasoning: true,
    });
  } catch (error) {
    console.error('Unhandled error in chat API:', error);
    throw error;
  }
}
