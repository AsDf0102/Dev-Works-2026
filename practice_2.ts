// practice_1.ts
// 04. 웹 검색 기능

import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
// 모델은 LangChain 생태계 모델 중 Tool에 장점이 있는 모델 사용

// State : Node들의 공유 보관소
import { MessagesZodState, StateGraph, START, END } from "@langchain/langgraph";

import { TavilySearch } from "@langchain/tavily"
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { SystemMessage } from "langchain";

// maxResults : 가져오는 문서의 양으로, 많을수록 토큰 사용량 증가
const tavilySearchTool = [new TavilySearch({ maxResults:5})]

// LLM : 명시적으로 llm(pmNode가 사용)에게 searchTool이 있다고 알려주기
const llm = new ChatOpenAI({
    model : 'gpt-4o-mini',
    temperature : 0,
    apiKey : process.env.OPEN_API_KEY
}).bindTools(tavilySearchTool);

// pmNode처럼 Node를 만들되, ToolNode로 정의
const searchNode = new ToolNode(tavilySearchTool);

const today = new Date().toISOString().split('T')[0];

// llm이 어떤 역할을 할 수 있는지 명확하게 전달하면,
// 적재적소에 알맞는 행동을 할 확률 높음

const systemPrompt = new SystemMessage(`
    [IMPORTANT 지시사항]
    1. **너는 웹 검색 도구를 가지고 있다. 실시간/최신 정보는 무조건 검색해.**
    2. "모른다", "학습 데이터 제한" 같은 말 절대 하지 마. 검색 먼저!
    3. 검색 후 결과를 바탕으로 정확히 답변.
    4. 검색 필요 없으면 바로 답변.

    현재 날짜: ${today}
    도구: TavilySearch (최대 5개 결과)
`);

async function pmNode(state: z.infer<typeof MessagesZodState>) {
  // 프롬프트를 사용자가 보낸 메시지와 함께 llm에게 전달
  const messagesWithSystem = [systemPrompt, ...state.messages];
  const response = await llm.invoke(messagesWithSystem);
  
  return { messages: [response] };
}

// pmNode가 검색 도구를 쓸지 말지 판단 노드
async function shouldContinue(state: z.infer<typeof MessagesZodState>) {
    return toolsCondition(state);
}

// conditionEdges => 조건부 Edge 연결
// 현재 워크플로우 : pmNode -> 내가 해결 가능> -> (no) -> toolNode 호출
//                                         -> (yes) -> pmNode 답변 및 대화 종료

// StateGraph에 Node 정의, Edge 연결
const workflow = new StateGraph(MessagesZodState)
    .addNode("agent", pmNode)
    .addNode("tools", searchNode)
    .addEdge(START, "agent")
    .addConditionalEdges("agent", shouldContinue, { // toolsCondition 사용
        tools: "tools",
        __end__: END,
    })
    .addEdge("tools", "agent");

export const graph = workflow.compile();

// 웹 검색 기능을 넣어도 검색 판단은 llm이므로 무조건 검색하게 하기 위해선 addConditionEdges -> addEdge로 수정
