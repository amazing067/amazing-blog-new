# 블로그 자동화 + MCP 가이드

## 0. 이 프로젝트에 추가된 MCP (`.cursor/mcp.json`)

전역에서 쓰려면 아래 내용을 **전역 설정 파일**에 복사하세요.  
Windows: `C:\Users\본인계정\.cursor\mcp.json`  
macOS/Linux: `~/.cursor/mcp.json`

| MCP | 용도 | API 키 |
|-----|------|--------|
| **context7** | 최신 라이브러리 문서 (Next.js, Supabase 등) | **무료** · [Context7](https://context7.com) 가입 후 API 키 발급 → `YOUR_CONTEXT7_API_KEY` 교체 |
| **sequential-thinking** | 단계별 사고·문제 분해 | 없음 |
| **figma** | Figma 디자인 → 코드 연동 | **무료** · Figma 계정(무료 가능) → Personal Access Token 발급 → `YOUR_FIGMA_API_KEY` 교체 |
| **browsermcp** | 브라우저 자동화 (네이버 블로그·카페 글쓰기/댓글 등) | 없음 (Chrome 확장 설치 권장) |
| **fetch** | URL에서 HTML/JSON/마크다운 가져오기 | 없음 |

- **Context7**: 가입만 하면 API 키 발급 가능(무료 플랜, 신용카드 불필요). 키 없으면 사용 불가.
- **Figma**: API 자체는 **유료가 아님**. Figma 무료 계정으로도 Personal Access Token 발급 가능. 키 없으면 Figma MCP 사용 불가.
- 둘 다 `mcp.json`에서 `YOUR_CONTEXT7_API_KEY`, `YOUR_FIGMA_API_KEY`를 실제 키로 바꾼 뒤 사용하세요.
- **전역 적용**: 전역 설정 파일 `~/.cursor/mcp.json`(Windows: `C:\Users\본인계정\.cursor\mcp.json`)에 이미 동일 내용이 적용되어 있을 수 있습니다. Cursor **재시작** 또는 **Settings → MCP → Refresh** 후 사용하세요.

---

## 1. API 키 발급 방법 (Context7, Figma)

### Context7 (무료 · 키 필요)

- **유료 여부**: 무료 플랜 있음. 가입 시 신용카드 불필요.
- **발급**: [context7.com](https://context7.com) → 로그인/가입 → 대시보드 → **API Keys** → **Create API Key** → 이름 입력(예: Cursor) → 생성된 키 복사(`ctx7sk-...`). **한 번만 표시되므로 반드시 복사**.
- **적용**: `.cursor/mcp.json` 또는 전역 `mcp.json`에서 `YOUR_CONTEXT7_API_KEY`를 복사한 키로 교체.
- 키 없으면 Context7 MCP 사용 불가.

### Figma (무료 · 키 필요)

- **유료 여부**: API용 Personal Access Token은 **무료**. Figma 무료 계정으로도 발급 가능.
- **발급**: [Figma](https://www.figma.com) 로그인 → 우측 상단 프로필 → **Settings** → **Security** 탭 → **Personal access tokens** → **Generate new token** → 이름 입력(예: MCP) → **범위(Scope) 설정** → 생성된 토큰 복사.
- **토큰 범위(Scope) 설정** (MCP용 최소 권장):
  - **`file_content:read`** — 필수. 파일 내용(노드, 레이아웃 등) 읽기. MCP가 디자인 데이터를 가져오는 데 필요.
  - **`file_metadata:read`** — 권장. 파일 메타정보(이름, 썸네일 등) 읽기.
  - 위 두 개만 체크하면 Cursor/코드 연동용으로 충분함. 댓글 읽기·프로젝트 목록이 필요하면 `file_comments:read`, `projects:read` 추가.
- **적용**: `mcp.json`의 `figma` 서버에서 `YOUR_FIGMA_API_KEY`를 복사한 토큰으로 교체. (또는 `env.FIGMA_API_KEY` 값으로 넣기)
- 키 없으면 Figma MCP 사용 불가.

---

## 2. 블로그·카페 자동화에 쓰는 MCP (네이버 블로그, 카페 글쓰기/댓글)

아래 MCP만 `.cursor/mcp.json`(또는 전역 설정)에 넣어 두면, **네이버 블로그 글 자동 작성**, **네이버 카페 등에 글 쓰기·댓글 달기** 같은 자동화에 사용할 수 있습니다.

| 용도 | MCP 서버 | 설명 |
|------|----------|------|
| **브라우저 자동화** | **browsermcp** (`@browsermcp/mcp`) | 네이버 블로그/티스토리/카페 로그인, 글쓰기 폼 채우기, **댓글 입력**, 스크린샷, 클릭/입력 자동화. 네이버 블로그 글 발행·카페 글쓰기·댓글 달기 모두 이 툴로 가능. |
| **웹 페이지 수집** | **fetch** (`@tokenizin/mcp-npx-fetch`) 또는 Cursor 내장 web-fetch | URL에서 본문/메타 가져오기 → 참고 자료 수집, 크롤링 대신 사용. |
| **파일/폴더** | 기본 파일 툴 | 생성된 HTML/마크다운 저장, 이미지 경로 확인. |
| **터미널** | 기본 툴 | `npm run build`, 스크립트 실행. |

- **네이버 블로그 자동화**: **browsermcp**로 네이버 로그인 → 블로그 글쓰기 페이지 이동 → 제목·본문·캡션 입력 → 미리보기·발행까지 자동화.
- **카페 글쓰기·댓글 달기**: **browsermcp**로 카페 접속 → 글쓰기 폼에 제목/내용 입력·발행, 또는 특정 글에 댓글 입력·등록 자동화.
- **리서치**: **fetch**로 참고 URL 내용 가져와서 프롬프트에 넣기.
- **이 프로젝트**: 이미지 생성, 카톡 링크, 설계서 분석은 앱 코드로 하고, MCP는 **블로그/카페 사이트에 올리는 단계**(글쓰기·댓글) 자동화용으로 쓰면 됨.

위 표의 MCP들(browsermcp, fetch 등)은 이 가이드의 **섹션 0**에 있는 `.cursor/mcp.json` 예시에 이미 포함되어 있으므로, 그대로 두고 API 키만 채우면 됩니다.

### 2.1 브라우저 자동화(browsermcp) 시작하기

**1단계: Chrome 확장 설치**

- [Browser MCP 확장 프로그램](https://browsermcp.io/install) 설치 (Chrome 웹 스토어).
- 설치 후 Chrome을 한 번 재시작하거나, 확장이 켜져 있는지 확인.

**2단계: Cursor에서 MCP 확인**

- 전역 설정(`~/.cursor/mcp.json`)에 `browsermcp`가 이미 있으면 별도 설정 없음.
- **Cursor → Settings → Tools → MCP** 에서 `browsermcp`가 켜져 있는지 확인. 끄져 있으면 토글로 켜기.

**3단계: 자동화 사용 방법**

- Cursor **Composer**(Agent) 또는 채팅에서 자연어로 요청하면 됨. 예:
  - *"네이버 블로그 로그인 페이지 열어줘"*
  - *"지금 열린 페이지에서 글쓰기 버튼 눌러줘"*
  - *"제목 입력란에 이 텍스트 넣어줘: 오늘의 보험 정리"*
  - *"네이버 카페 ○○ 카페 들어가서 새 글 쓰기 화면 열어줘"*
- 브라우저는 **지금 쓰는 Chrome 프로필**을 그대로 사용하므로, 이미 네이버에 로그인된 상태라면 로그인 단계 없이 글쓰기·카페 이동만 요청해도 됨.
- 처음에는 **한 단계씩** 요청해 보다가(예: "네이버 블로그 글쓰기 페이지로 이동해줘" → "제목란에 '테스트' 입력해줘") 익숙해지면 "블로그 글쓰기 페이지 열고 제목·본문 채워줘"처럼 묶어서 요청 가능.

**4단계: 네이버 블로그 글 발행 흐름 예시**

1. *"네이버 블로그 글쓰기(에디터) 페이지 열어줘"*
2. *"제목 입력란에 [원하는 제목] 입력해줘"*
3. *"본문 영역에 [원하는 내용] 입력해줘"*
4. *"발행(또는 게시) 버튼 눌러줘"* (미리보기 먼저 원하면 "미리보기 버튼 눌러줘" 요청)

카페 글쓰기·댓글도 같은 방식으로, *"○○ 카페 이 글에 댓글 달아줘: [내용]"* 처럼 단계별로 요청하면 됨.

---

## 3. MCP 설정 위치 (다른 폴더에서 설정한 것과의 관계)

Cursor에서 MCP는 **두 군데** 중 하나에 설정합니다.

| 위치 | 경로 | 적용 범위 |
|------|------|-----------|
| **프로젝트별** | 프로젝트 루트 `.cursor/mcp.json` | **이 프로젝트(amazing-biz-blog)에서만** 사용 |
| **전역** | `~/.cursor/mcp.json` (사용자 홈) | **모든 프로젝트**에서 공통 사용 |

- **다른 폴더에서만 설정했다**  
  - 그 폴더가 **그 프로젝트의 `.cursor/mcp.json`** 이었다면 → 그 설정은 **그 프로젝트에만** 적용됩니다.  
  - **이 프로젝트(amazing-biz-blog)에는 MCP가 없으므로**, 여기서 쓰려면 둘 중 하나가 필요합니다.  
    1. **이 프로젝트에만** 쓰고 싶다 → 이 프로젝트 루트에 `.cursor/mcp.json` 만들고 같은(또는 필요한) MCP 서버 설정.  
    2. **모든 프로젝트**에서 쓰고 싶다 → 전역 `~/.cursor/mcp.json`에 설정 (다른 폴더에서 했던 설정을 여기로 옮기거나, 여기서 한 번만 설정).

- **전역(`~/.cursor/mcp.json`)에 설정했다**  
  - 이 프로젝트를 열어도 **같은 MCP 툴이 그대로** 사용 가능해야 합니다.  
  - 만약 “MCP 툴이 없다”고 보인다면: Cursor 재시작, MCP 서버 리프레시, 또는 Cursor 설정 → MCP에서 서버가 켜져 있는지 확인해 보세요.

정리: **다른 폴더에서 한 설정은 “그 프로젝트 전용”이면 여기로 자동으로 따라오지 않습니다. 이 프로젝트에서 쓰려면 여기 `.cursor/mcp.json`을 만들거나, 전역 `~/.cursor/mcp.json`에 설정해야 합니다.**

---

## 4. 이 프로젝트에 MCP 넣는 방법 (프로젝트별 설정)

이 저장소에서만 MCP를 쓰고 싶다면:

1. 프로젝트 루트에 `.cursor` 폴더 생성.
2. `.cursor/mcp.json` 파일을 만들고 아래처럼 서버를 추가 (예: 브라우저 자동화).

```json
{
  "mcpServers": {
    "cursor-ide-browser": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/cursor-ide-browser-mcp@latest"]
    }
  }
}
```

- Cursor에 따라 `cursor-ide-browser`는 이미 내장되어 있을 수 있어, 그 경우 위 항목이 중복이거나 이름이 다를 수 있습니다.
- **Cursor 설정 UI 사용**:  
  **Settings → Tools → MCP** 에서 “New MCP server”로 추가하면, Cursor가 자동으로 전역 또는 프로젝트용 설정 파일을 만듭니다.  
  - 그렇게 추가한 MCP는 “다른 폴더”가 아니라 **현재 사용 중인 설정 파일 위치**에 저장되므로,  
    “다른 폴더에서 설정한 것”이 이 프로젝트에 안 보인다면 **이 프로젝트를 연 상태에서** 같은 MCP를 한 번 더 추가해 주면 됩니다.

---

## 5. “MCP 툴이 없다”고 나올 때 점검

1. **Cursor 설정 → Tools → MCP**  
   - 등록된 서버가 있는지, 토글이 켜져 있는지 확인.
2. **설정 파일 위치**  
   - 프로젝트만 쓰기: `amazing-biz-blog/.cursor/mcp.json` 존재 여부.  
   - 전역: `~/.cursor/mcp.json` (Windows: `C:\Users\본인계정\.cursor\mcp.json`) 존재 여부.
3. **리로드**  
   - MCP 쪽 “Refresh” 버튼 또는 Cursor 재시작.
4. **실행 환경**  
   - `npx`로 실행하는 MCP면 Node.js가 PATH에 있고, 방화벽/백신이 npx 실행을 막지 않는지 확인.

---

## 6. 요약

- **블로그 자동화에 쓸 MCP**: 브라우저 자동화(포스팅·스크린샷), 웹 fetch(리서치). 나머지는 기존 앱 코드로 충분.
- **다른 폴더에서 설정한 MCP**: 그게 **그 프로젝트의 `.cursor/mcp.json`**이면 이 프로젝트에는 적용 안 됨.  
  → 이 프로젝트에서 쓰려면 **여기 `.cursor/mcp.json`을 새로 만들거나**, **전역 `~/.cursor/mcp.json`**에 설정해야 함.
- **MCP 툴이 안 보일 때**: Cursor 설정에서 MCP 등록·리프레시, 설정 파일 위치(프로젝트 vs 전역) 확인.
