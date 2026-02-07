import { LlamaCloud } from "@llamaindex/llama-cloud";

const pipelineId = "edcf413d-006c-42d2-8e6e-ef940d38611e";

let clientInstance: LlamaCloud | null = null;

function getClient() {
  if (!clientInstance) {
    clientInstance = new LlamaCloud({
      apiKey: process.env.LLAMA_CLOUD_API_KEY,
    });
  }
  return clientInstance;
}

export const retriever = {
  retrieve: async (query: string) => {
    const client = getClient();

    const response = await client.pipelines.retrieve(pipelineId, {
      query,
      dense_similarity_top_k: 5,
      sparse_similarity_top_k : 5,
      rerank_top_n: 5,
    });

    return response.retrieval_nodes;
  },
};