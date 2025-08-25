// import { google } from '@ai-sdk/google';
import { generateText, streamText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { NextResponse } from 'next/server';
import { MilvusClient } from '@zilliz/milvus2-sdk-node';
const MILVUS_ADDRESS = '127.0.0.1:19530'; // Change if hosted remotely
import { GoogleGenerativeAI } from '@google/generative-ai';

const google = createGoogleGenerativeAI({
	apiKey: process.env.GOOGLE_API_KEY,
});
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

const client = new MilvusClient({
	address: MILVUS_ADDRESS,
});

async function searchChunks(queryVector, topK = 5) {
	//  const searchResults = await client.search({
	//   collection_name: "f1_data1",
	//   vectors: [queryVector], // Query as batch of 1
	//   params: { nprobe: 10 }, // Search parameter, tune as needed
	//   limit: topK,
	//   output_fields: ['url', 'chunkText'], // Fields to return
	// });
	const searchResults = await client.search({
		collection_name: 'f1_data1',
		vectors: [queryVector],
		search_params: {
			anns_field: 'vector',
			topk: '5',
			metric_type: 'COSINE',
			params: JSON.stringify({ nprobe: 10 }),
		},
		output_fields: ['text'],
	});

	// console.log('✅ Search results:', searchResults);
	return searchResults.results;
}

export async function POST(req) {
	try {
		const { messages } = await req.json();
		const latestMsg = messages?.at(-1)?.content ?? '';
		const embeddingModel = genAI.getGenerativeModel({ model: 'embedding-001' });
		const embedresult = await embeddingModel.embedContent(latestMsg);
		const results = await searchChunks(embedresult.embedding.values, 3);

		//console.log(results, 'res');

		const context =
			results
				?.map((r) => r.text.trim())
				.join('\n')
				.substring(0, 5000) || ''; // Ensure it fits Gemini's limit
		// const {text} = await generateText({
		//     model: google('gemini-2.0-flash'),
		//     prompt: `Based on the following website content, answer the user's question as accurately as possible.
		//   If the full answer is NOT in the provided content, provide whatever relevant information is available.
		//   Do NOT include information from external sources.

		//   Website Content:
		//   ${context}

		//   User Query:
		//   ${messages[0].text}

		//   If you cannot find any relevant information from the content, respond with exactly: "Data not found".
		// `,
		//   });

		// return NextResponse.json({ response: text }, { status: 200 });
		//console.log('Context:', context);
		//  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

		const prompt =    `Based on the following website content, answer the user's question as accurately as possible.
		  If the full answer is NOT in the provided content, provide whatever relevant information is available.
		  Do NOT include information from external sources.

		  Website Content:
		  ${context}

		  User Query:
		  ${messages[0].text}

		  If you cannot find any relevant information from the content, respond with exactly: "Data not found".
		`;

		// 4. Generate stream
		// const result = await model.generateContentStream({
		//   contents: [{ role: 'user', parts: [{ text: prompt }] }],
		// });

		// const encoder = new TextEncoder();
		// const stream = new ReadableStream({
		//   async start(controller) {
		//     for await (const chunk of result.stream) {
		//       const text = chunk.text();
		//       controller.enqueue(encoder.encode(text));
		//     }
		//     controller.close();
		//   },
		// });
		const result = await streamText({
			model: google('gemini-1.5-flash'),
			system: prompt,
			messages,
		});
		return result.toDataStreamResponse();
		// 5. Return streamed response
		//  return new Response(stream, {
		//     headers: {
		//       'Content-Type': 'text/event-stream',
		//       'Cache-Control': 'no-cache',
		//       Connection: 'keep-alive',
		//     },
		//   });
	} catch (error) {
		console.error('Chat API Error:', error);
		return NextResponse.json(
			{ error: 'Error generating response' },
			{ status: 500 }
		);
	}
}
