# 프로젝트 셋업 가이드

이 폴더에는 프로젝트 실행에 필요한 설정 파일들이 포함되어 있습니다.

---

## 1. Node.js 버전 확인

필요한 Node.js 버전: **v20**

### macOS / Linux (nvm 사용)

```bash
# nvm이 설치되어 있는 경우
nvm install 20
nvm use 20
```

nvm이 없는 경우 설치: https://github.com/nvm-sh/nvm#install--update-script

### Windows

#### 옵션 1: nvm-windows 사용 (추천)

```powershell
# nvm-windows가 설치되어 있는 경우
nvm install 20
nvm use 20
```

다운로드: https://github.com/coreybutler/nvm-windows/releases

#### 옵션 2: 공식 설치 파일 사용

다운로드: https://nodejs.org/ (v20 LTS 버전 설치)

---

## 2. 의존성 설치

```bash
npm install
```

---

## 3. 환경 변수 설정

`.env.example`을 복사하여 `.env` 파일을 생성하고, 실제 API 키를 입력하세요.

### macOS / Linux

```bash
cp .env.example .env
```

### Windows (PowerShell)

```powershell
Copy-Item .env.example .env
```

### Windows (CMD)

```cmd
copy .env.example .env
```

그 후 `.env` 파일을 열어서 각 API 키에 실제 값을 입력하세요:

- `GOOGLE_API_KEY` - Google Generative AI API 키 (필수)
- `TAVILY_API_KEY` - Tavily Search API 키 (선택)
- `LLAMA_CLOUD_API_KEY` - LlamaIndex Cloud API 키 (선택)
- `LANGSMITH_API_KEY` - LangSmith Tracing API 키 (선택, 디버깅용)

---

## 4. 프로젝트 실행

이 프로젝트는 빌드 없이 `tsx`를 사용하여 TypeScript 파일을 직접 실행합니다.

```bash
# practice 파일 실행
npx tsx practice_1.ts
npx tsx practice_2.ts
npx tsx practice_3.ts
npx tsx practice_4.ts
npx tsx practice_5.ts

```

---

## 5. 파일 설명

| 파일            | 설명                                                 |
| --------------- | ---------------------------------------------------- |
| `package.json`  | 프로젝트 의존성 및 스크립트 정의                     |
| `tsconfig.json` | TypeScript 컴파일러 설정                             |
| `.gitignore`    | Git에서 제외할 파일/폴더 목록                        |
| `.nvmrc`        | nvm에서 사용할 Node.js 버전 (macOS/Linux)            |
| `.node-version` | nodenv/avn 등에서 사용할 Node.js 버전 (Windows 호환) |
| `.env.example`  | 환경 변수 템플릿                                     |

---

## 6. Windows 사용자 참고사항

- **nvm 사용**: nvm-windows를 설치하면 `.nvmrc` 파일은 자동으로 감지되지 않습니다. 수동으로 `nvm use 20` 명령을 실행해야 합니다.
- **파일 복사**: 위에서 안내한 `copy` 또는 `Copy-Item` 명령을 사용하세요.
- **터미널**: PowerShell을 사용하는 것을 권장합니다.

---

## 7. 문제 해결

### Node.js 버전이 맞지 않을 때

```bash
node -v  # 현재 버전 확인
```

### 모듈을 찾을 수 없는 에러

```bash
# node_modules 삭제 후 재설치
rm -rf node_modules package-lock.json  # macOS/Linux
rmdir /s /q node_modules && del package-lock.json  # Windows (CMD)
npm install
```

자세한 내용은 `AGENTS.md` 파일을 참고하세요.
