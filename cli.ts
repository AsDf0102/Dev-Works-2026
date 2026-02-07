// cli.ts - 완전히 새로 작성
import "dotenv/config";
import * as readline from "readline";
import { HumanMessage } from "@langchain/core/messages";
import { planExecuteGraph } from "./practice_5.ts";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
}


async function runPlanExecuteAgent() {
  console.log("\n🧠 Plan-Execute Agent 모드");
  console.log("=".repeat(50));
  console.log("복잡한 작업을 단계별로 계획하고 실행합니다");
  console.log("종료하려면 'exit' 또는 'quit'를 입력하세요\n");

  while (true) {
    const userInput = await question("\n👤 You: ");

    if (userInput.toLowerCase() === "exit" || userInput.toLowerCase() === "quit") {
      console.log("\n👋 대화를 종료합니다.");
      break;
    }

    if (!userInput.trim()) continue;

    console.log("\n📋 계획 수립 중...");
    
    const config = { configurable: { thread_id: "plan-" + Date.now() } };
    let planDisplayed = false;

    try {
      // 초기 실행
      const stream = await planExecuteGraph.stream(
        { messages: [new HumanMessage(userInput)] },
        config
      );

      for await (const chunk of stream) {
        if (chunk.planner?.plan && !planDisplayed) {
          console.log("\n📝 실행 계획:");
          chunk.planner.plan.forEach((step: string, idx: number) => {
            console.log(`  ${idx + 1}. ${step}`);
          });
          planDisplayed = true;
        }
        
        if (chunk.execute) {
          console.log("\n⚙️ 단계 실행 중…");
        }
        
        if (chunk.replan?.response) {
          console.log("\n✅ 최종 답변:");
          console.log(chunk.replan.response);
        }
        
        if (chunk.replan?.plan) {
          console.log("\n🔄 남은 작업:");
          chunk.replan.plan.forEach((step: string, idx: number) => {
            console.log(`  ${idx + 1}. ${step}`);
          });
        }
      }

      // interrupt 처리 루프
      while (true) {
        const state = await planExecuteGraph.getState(config);
        
        if (state.next.length === 0) {
          break;
        }

        const interrupted = state.tasks?.some(task => task.interrupts?.length > 0);
        
        if (interrupted) {
          const lastMsg = state.values.messages[state.values.messages.length - 1];
          
          if (lastMsg?.tool_calls?.length > 0) {
            console.log("\n⚠️  도구 호출:", lastMsg.tool_calls.map(tc => tc.name).join(", "));
            const approval = await question("승인하시겠습니까? (yes/no): ");
            
            if (approval.toLowerCase() !== "yes") {
              console.log("❌ 도구 실행이 거부되었습니다.");
              break;
            }
          }

          // 재개
          const resumeStream = await planExecuteGraph.stream(null, config);
          
          for await (const chunk of resumeStream) {
            if (chunk.execute) {
              console.log("\n⚙️ 단계 실행 중…");
            }
            
            if (chunk.replan?.response) {
              console.log("\n✅ 최종 답변:");
              console.log(chunk.replan.response);
            }
            
            if (chunk.replan?.plan) {
              console.log("\n🔄 남은 작업:");
              chunk.replan.plan.forEach((step: string, idx: number) => {
                console.log(`  ${idx + 1}. ${step}`);
              });
            }
          }
        } else {
          break;
        }
      }

    } catch (error: any) {
      console.error("\n❌ 오류:", error.message);
    }
  }
}

async function main() {

await runPlanExecuteAgent();

}

main().catch(console.error);