import { MilvusClient, DataType } from "@zilliz/milvus2-sdk-node";
import { PuppeteerWebBaseLoader } from "langchain/document_loaders/web/puppeteer";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { GoogleGenerativeAI } from "@google/generative-ai";

import "dotenv/config";

// Environment Variables
const {
  GOOGLE_API_KEY,
  MILVUS_COLLECTION = "f1_data1"
} = process.env;

// Gemini Client
const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY!);

// Web sources to embed
const f1Data = [
  "https://en.wikipedia.org/wiki/Formula_One",
  // "https://en.wikipedia.org/wiki/List_of_Formula_One_World_Drivers%27_Champions",
  // "https://www.formula1.com/en/latest",
  // "https://www.skysports.com/f1",
];

// Milvus Client
const milvus = new MilvusClient({ address: "127.0.0.1:19530" });

// Text splitter
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 512,
  chunkOverlap: 100,
});

const VECTOR_DIM = 768; // Gemini returns 768-d vectors

const waitForMilvusReady = async () => {
  for (let i = 0; i < 10; i++) {
    try {
      const res = await milvus.checkHealth();
      if (res?.isHealthy) {
        console.log("Milvus is healthy");
        return;
      }
    } catch {
      console.log(`Waiting for Milvus to be ready... (${i + 1}/10)`);
    }
    await new Promise((res) => setTimeout(res, 2000));
  }
  throw new Error(" Milvus did not become ready in time.");
};

const createMilvusCollection = async () => {
  const collections = await milvus.showCollections();
  const exists = collections.data.some(c => c.name === MILVUS_COLLECTION);

  if (!exists) {
    await milvus.createCollection({
      collection_name: MILVUS_COLLECTION,
      fields: [
        {
          name: "id",
          description: "Unique id",
          data_type: DataType.Int64,
          is_primary_key: true,
          autoID: true,
        },
        {
          name: "text",
          data_type: DataType.VarChar,
          max_length: 65535,
        },
        {
          name: "vector",
          data_type: DataType.FloatVector,
          type_params: { dim: VECTOR_DIM.toString() },
        },
      ],
    });

    await milvus.createIndex({
      collection_name: MILVUS_COLLECTION,
      field_name: "vector",
      index_name: "vector_idx",
      index_type: "IVF_FLAT",
      metric_type: "COSINE",
      params: { nlist: 128 },
    });

    await milvus.loadCollectionSync({ collection_name: MILVUS_COLLECTION });
    console.log(`Created and loaded collection: ${MILVUS_COLLECTION}`);
  } else {
    console.log(`Collection already exists: ${MILVUS_COLLECTION}`);
  }
};

const scrapePage = async (url: string) => {
  const loader = new PuppeteerWebBaseLoader(url, {
    launchOptions: {
      headless: true,
      executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      timeout: 60000,
    },
    gotoOptions: {
      waitUntil: "domcontentloaded",
    },
    evaluate: async (page, browser) => {
      const result = await page.evaluate(() => document.body.innerHTML);
      await browser.close();
      return result;
    }
  });

  return (await loader.scrape())?.replace(/<[^>]*>?/gm, '');
};

const embedWithGemini = async (text: string): Promise<number[]> => {
  const model = genAI.getGenerativeModel({ model: "embedding-001" });

  const result = await model.embedContent({
    "content": {
      role: "user",
      parts: [{ text }],
    },
  });

  return result.embedding.values;
};

const insertWithRetry = async (batch, retries: number) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await milvus.insert({
        collection_name: MILVUS_COLLECTION,
        fields_data: batch,
      });
      return;
    } catch (err) {
      console.warn(`Insert failed (attempt ${attempt}/${retries}):`, err.message);
      if (attempt === retries) {
        throw new Error(`Insert failed after ${retries} attempts.`);
      }
      await new Promise(res => setTimeout(res, 500 * attempt));
    }
  }
};

const loadSampleData = async () => {
  const batchSize = 10;
  const maxRetries = 3;
  const throttleMs = 200;

  for await (const url of f1Data) {
    try {
      console.log(`🌐 Scraping: ${url}`);
      const content = await scrapePage(url);
      const chunks = await splitter.splitText(content);

      let batch = [];
      let totalInserted = 0;

      for await (const chunk of chunks) {
        const vector = await embedWithGemini(chunk);
        batch.push({ text: chunk, vector });

        if (batch.length >= batchSize) {
          await insertWithRetry(batch, maxRetries);
          totalInserted += batch.length;
          console.log(` Inserted batch (${batch.length}) | Total: ${totalInserted}`);
          batch = [];
          await new Promise(res => setTimeout(res, throttleMs));
        }
      }

      if (batch.length > 0) {
        await insertWithRetry(batch, maxRetries);
        totalInserted += batch.length;
        console.log(`✅ Inserted final batch (${batch.length}) | Total: ${totalInserted}`);
      }
    } catch (err) {
      console.error(`Error processing ${url}:`, err);
    }
  }
};

const start = async () => {
  try {
    await waitForMilvusReady();
    await createMilvusCollection();
    await loadSampleData();
    console.log("🎉 All data loaded into Milvus successfully.");
  } catch (err) {
    console.error("Fatal Error:", err);
  }
};

start();
