// app/api/chat/route.ts
import { NextRequest } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { MilvusClient } from '@zilliz/milvus2-sdk-node';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
const embedModel = genAI.getGenerativeModel({ model: 'embedding-001' });
const chatModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

const milvus = new MilvusClient({
  address: '127.0.0.1:19530',
  ssl: false,
});

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();
    const latestMsg = messages?.at(-1)?.content ?? '';

    const embedRes = await embedModel.embedContent({
      content: { role: 'user', parts: [{ text: latestMsg }] },
    });

    const queryVector = embedRes.embedding.values;

    await milvus.loadCollectionSync({ collection_name: 'f1_data' });

    const searchRes = await milvus.search({
      collection_name: 'f1_data',
      vectors: [queryVector],
      search_params: {
        anns_field: 'vector',
        topk: '5',
        metric_type: 'COSINE',
        params: JSON.stringify({ nprobe: 10 }),
      },
      output_fields: ['text'],
    });

    const context = searchRes.results?.map((r) => r.text).join('\n') || '';

    const prompt = `
You are an AI Assistant specialized in Formula 1.
Use the following context to answer the question.

CONTEXT:
${context}

QUESTION:
${latestMsg}`;

    const result = await chatModel.generateContentStream({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async pull(controller) {
        const messageId = 'chatcmpl-' + Math.random().toString(36).slice(2);
    
       try{ for await (const chunk of result.stream) {
          const text = chunk.text();
          console.log(text,"text")
    
          if (text) {
            const payload = {
              id: messageId,
              object: 'chat.completion.chunk',
              choices: [
                {
                  delta: {
                    role: 'assistant',
                    content: text,
                  },
                },
              ],
            };
  
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
          }
        }}
        catch(e){
          console.log("error in stream Data",e)
        }
    
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });
    
    console.log(stream,"stream")

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (err) {
    console.error('[CHAT API ERROR]', err);
    return new Response('Internal Server Error', { status: 500 });
  }
}
