// practice_1.ts
// 03. 초간단 챗봇 만들기

import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
// 모델은 LangChain 생태계 모델 중 Tool에 장점이 있는 모델 사용


// State : Node들의 공유 보관소
import { MessagesZodState, StateGraph, START, END } from "@langchain/langgraph";

/*
커스텀 필드 사용 : 스키마 필드 생성 후 상호작용
본 프로젝트에서는 유지보수 문제로 모듈로 대체
const State = new StateSchema({
    messages : z.array(z.any()),
    count: z.number().default(0),
})
*/

// LLM 
const llm = new ChatOpenAI({
    model : 'gpt-4o-mini',
    temperature : 0.3,
    apiKey : process.env.OPEN_API_KEY
})

// PM Node
async function pmNode(state : z.infer<typeof MessagesZodState>) {
    const response = await llm.invoke(state.messages);
    return { messages : [response] };
}

// StateGraph에 Node 정의, Edge 연결
const workflow = new StateGraph(MessagesZodState)
    .addNode("pm", pmNode)
    .addEdge(START, "pm")
    .addEdge("pm", END);

export const graph = workflow.compile();

