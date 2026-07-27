import Anthropic from '@anthropic-ai/sdk';
import { getBuilderSystemPrompt } from '@/lib/builder/system-prompt';

const client = new Anthropic();

export async function POST(request: Request) {
  const { messages, campaignContext } = await request.json();

  const systemPrompt = getBuilderSystemPrompt(campaignContext);

  const stream = await client.beta.messages.stream({
    model: 'claude-fable-5',
    // Fable's always-on thinking counts against max_tokens, so the cap needs
    // headroom well beyond the visible reply length.
    max_tokens: 64000,
    system: systemPrompt,
    messages: messages.map((m: { role: string; content: string }) => ({
      role: m.role,
      content: m.content,
    })),
    betas: ['server-side-fallback-2026-07-01'],
    // Fable's safety classifiers can decline a request outright; this reruns
    // a declined request on Anthropic's recommended fallback model in the
    // same call. Spread because SDK 0.80 typings don't know the param yet.
    ...{ fallbacks: 'default' },
  });

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`)
            );
          }
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === 'refusal') {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: 'Claude declined to respond to this request.' })}\n\n`
            )
          );
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`)
        );
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
