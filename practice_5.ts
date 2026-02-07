// practice_5.ts
import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import { StateGraph, START, END, MessagesZodState, interrupt, Annotation, MessagesAnnotation } from "@langchain/langgraph";
import { z } from "zod";
import { TavilySearch } from "@langchain/tavily";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { AIMessage, SystemMessage, BaseMessage, ToolMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";

const tavilySearchTool = [new TavilySearch({ maxResults: 5 })];

// Checkpointer 생성
const checkpointer = new MemorySaver();

// 1. Plan 스키마 정의
const Plan = z.object({
  steps: z.array(z.string()).describe("실행할 단계별 작업 목록")
});

const Response = z.object({
  response: z.string().describe("사용자에게 전달할 최종 답변")
});

// OpenAI structured output 호환 스키마
const ReplanOutput = z.object({
  type: z.enum(["plan", "response"]).describe("출력 타입: 계획 업데이트(plan) 또는 최종 응답(response)"),
  steps: z.array(z.string()).nullable().describe("남은 실행 단계 목록 (type이 plan일 때만 사용, response일 때는 null)"),
  response: z.string().nullable().describe("최종 답변 내용 (type이 response일 때만 사용, plan일 때는 null)")
});

// 2. PlanExecute State 정의
const PlanExecuteState = Annotation.Root({
  ...MessagesAnnotation.spec,
  plan: Annotation<string[]>({
    reducer: (x, y) => y ?? x ?? [],
    default: () => []
  }),
  pastSteps: Annotation<[string, string][]>({
    reducer: (x, y) => x.concat(y),
    default: () => []
  }),
  response: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => ""
  })
});

// 3. 모델 정의
const llm = new ChatOpenAI({ 
    model: "gpt-4o-mini", 
    temperature: 0,
    apiKey: process.env.OPENAI_API_KEY
});

const today = new Date().toISOString().split('T')[0]; 

// 4. Planner 노드
const plannerPrompt = `현재 날짜: ${today}

당신의 역할: 주어진 목표를 달성하기 위한 단계별 실행 계획을 수립하는 것입니다.

지침:
1. 목표를 작고 구체적인 단계로 나누세요 (3-5개 정도)
2. 각 단계는 독립적으로 실행 가능해야 합니다
3. 실시간/최신 정보가 필요한 경우 검색 단계를 포함하세요
4. 단계는 논리적 순서로 배열하세요
5. 너무 많은 단계를 만들지 마세요 (핵심만)

사용 가능한 도구: TavilySearch (웹 검색)`;

async function planNode(state: typeof PlanExecuteState.State) {
  const messages = [
    new SystemMessage(plannerPrompt),
    ...state.messages
  ];
  
  const model = llm.withStructuredOutput(Plan);
  const response = await model.invoke(messages);
  
  return { plan: response.steps };
}

// 5. Executor 노드
const executorPrompt = `현재 날짜: ${today}

당신의 역할: 주어진 단계를 실행하는 것입니다.

지침:
1. 실시간/최신 정보는 무조건 TavilySearch 도구를 사용하여 검색하세요
2. "모른다", "학습 데이터 제한" 같은 말 절대 하지 마세요
3. 검색 결과를 바탕으로 정확히 답변하세요
4. 검색이 필요 없으면 바로 답변하세요

사용 가능한 도구: TavilySearch (최대 5개 결과)`;

const executorLlm = llm.bindTools(tavilySearchTool);

async function executeNode(state: typeof PlanExecuteState.State) {
  const task = state.plan[0];
  const input = `실행할 작업: ${task}\n\n이전 완료된 작업들:\n${
    state.pastSteps.map(([step, result]) => `- ${step}: ${result}`).join('\n')
  }`;
  
  const messages = [
    new SystemMessage(executorPrompt),
    { role: "user", content: input }
  ];
  
  const response = await executorLlm.invoke(messages);
  
  return { messages: [response] };
}

// 6. Tool 실행 노드
const searchNode = new ToolNode(tavilySearchTool);

// authNode 완전히 제거!

// 7. Replan 노드
const replannerPrompt = `현재 날짜: ${today}

당신의 역할: 원래 계획과 실행 결과를 검토하여 다음 단계를 결정하는 것입니다.

**중요: type 필드에 따라 필수/null 설정**

1. 목표가 달성되었다면:
   - type: "response"
   - response: 사용자에게 전달할 최종 답변 (명확하고 완전하게 작성)
   - steps: null

2. 아직 작업이 남았다면:
   - type: "plan"
   - steps: 남은 작업 목록 배열 (이미 완료된 첫 번째 작업은 제거)
   - response: null

지침:
- 실행 결과를 바탕으로 정확히 판단하세요
- 최종 답변은 모든 단계의 결과를 종합해야 합니다
- type에 맞춰 정확히 필드를 설정하세요`;

async function replanNode(state: typeof PlanExecuteState.State) {
  // 메시지에서 실행 결과만 추출 (tool_calls 제거)
  const lastMessage = state.messages[state.messages.length - 1];
  let executionResult = "";
  
  if (lastMessage.constructor.name === "ToolMessage" || lastMessage._getType() === "tool") {
    executionResult = (lastMessage as ToolMessage).content as string;
  } else if (lastMessage.constructor.name === "AIMessage" || lastMessage._getType() === "ai") {
    executionResult = (lastMessage as AIMessage).content as string;
  }
  
  const output = await llm.withStructuredOutput(ReplanOutput).invoke([
    new SystemMessage(replannerPrompt),
    {
      role: "user",
      content: `원래 계획: ${JSON.stringify(state.plan)}

이전 완료된 작업들:
${state.pastSteps.map(([step, result]) => `- ${step}: ${result}`).join('\n')}

방금 완료된 작업: ${state.plan[0]}
실행 결과: ${executionResult}

위 정보를 바탕으로 다음 단계를 결정하세요.`
    }
  ]);
  
  if (output.type === "response" && output.response) {
    return { response: output.response };
  } else if (output.type === "plan" && output.steps && output.steps.length > 0) {
    return {
      plan: output.steps,
      pastSteps: [[state.plan[0], executionResult]] as [string, string][]
    };
  } else {
    // fallback: 응답이 제대로 안 온 경우
    return { response: "작업을 완료했습니다." };
  }
}

// 8. 조건부 엣지 함수들
function shouldExecuteTool(state: typeof PlanExecuteState.State) {
  const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
  
  if (lastMessage?.tool_calls && lastMessage?.tool_calls?.length > 0) {
    return "tools";  // auth 대신 tools로 직접 이동
  }
  return "replan";
}

function shouldEnd(state: typeof PlanExecuteState.State) {
  if (state.response) {
    return END;
  }
  return "execute";
}

// 9. Plan-Execute 그래프 구성 (auth 노드 제거)
const planExecuteWorkflow = new StateGraph(PlanExecuteState)
  .addNode("planner", planNode)
  .addNode("execute", executeNode)
  .addNode("tools", searchNode)  // auth 노드 제거
  .addNode("replan", replanNode)
  .addEdge(START, "planner")
  .addEdge("planner", "execute")
  .addConditionalEdges("execute", shouldExecuteTool, {
    tools: "tools",  // auth 거치지 않고 바로 tools로
    replan: "replan"
  })
  .addEdge("tools", "replan")  // tools -> replan으로 바로 연결
  .addConditionalEdges("replan", shouldEnd, {
    execute: "execute",
    [END]: END
  });

export const planExecuteGraph = planExecuteWorkflow.compile({ checkpointer });