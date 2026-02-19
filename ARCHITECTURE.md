# Architecture & Workflow Integration

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                   USER BROWSER                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │           Next.js Frontend (React)                  │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │ │
│  │  │ File Upload  │  │ Chat Display │  │   Input   │ │ │
│  │  │  (Drag Drop) │  │  (Messages)  │  │   Field   │ │ │
│  │  └──────┬───────┘  └──────┬───────┘  └─────┬─────┘ │ │
│  └─────────┼──────────────────┼──────────────────┼──────┘ │
│            │ FormData         │ Response         │ Send   │
└────────────┼──────────────────┼──────────────────┼────────┘
             │                  │                  │
             ▼                  ▼                  ▼
    ┌────────────────────────────────────────────────────┐
    │         Next.js Backend API Route                   │
    │         POST /api/chat/route.ts                     │
    │  ┌────────────────────────────────────────────────┐ │
    │  │ 1. Parse FormData (file + message)             │ │
    │  │ 2. Run Guardrails (PII, moderation)            │ │
    │  │ 3. Route to Agent                              │ │
    │  │    - If "evaluate/review" → Proposal Evaluator │ │
    │  │    - Else → Web Search Agent                   │ │
    │  │ 4. Return response                             │ │
    │  └────────────────────────────────────────────────┘ │
    └────────┬────────────────────────────────────────────┘
             │
    ┌────────▼────────────────────────────────────────────┐
    │      OpenAI Agents & Services                        │
    │  ┌────────────────────────────────────────────────┐ │
    │  │ Guardrails                                     │ │
    │  │ ├─ PII Detection (CREDIT_CARD, SSN, etc.)     │ │
    │  │ ├─ Moderation (harmful content)               │ │
    │  │ └─ Anonymization (if needed)                  │ │
    │  └────────────────────────────────────────────────┘ │
    │  ┌────────────────────────────────────────────────┐ │
    │  │ Proposal Evaluator Agent                       │ │
    │  │ ├─ Tool: File Search (for document analysis)  │ │
    │  │ ├─ Criteria: Problem, Solution, Feasibility   │ │
    │  │ └─ Output: Score + Evidence + Recommendations │ │
    │  └────────────────────────────────────────────────┘ │
    │  ┌────────────────────────────────────────────────┐ │
    │  │ Web Search Agent                               │ │
    │  │ └─ Searches and compiles information tables   │ │
    │  └────────────────────────────────────────────────┘ │
    └────────────────────────────────────────────────────┘
             │
             ▼
    ┌────────────────────────────────────────────────────┐
    │  OpenAI File Search Vector Store                    │
    │  (Document embedding & semantic search)            │
    └────────────────────────────────────────────────────┘
```

## Data Flow

### 1. User Interaction
```
User Actions:
  1. Uploads file (PDF, PPTX, image, txt)
  2. Enters question
  3. Clicks "Send"
```

### 2. Frontend Processing
```typescript
// ChatInterface.tsx
const handleSendMessage = async (text: string) => {
  const formData = new FormData()
  formData.append('message', text)
  formData.append('file', uploadedFile)
  
  const response = await fetch('/api/chat', {
    method: 'POST',
    body: formData
  })
  
  // Display response in chat
}
```

### 3. Backend Processing
```typescript
// /api/chat/route.ts
export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const message = formData.get('message')
  const file = formData.get('file')
  
  // Step 1: Guardrails
  const { hasTripwire } = await runAndApplyGuardrails(
    message,
    guardrailsConfig,
    conversationHistory,
    workflow
  )
  
  if (hasTripwire) return guardrailsFailOutput
  
  // Step 2: Route to agent
  if (isEvaluationRequest(message)) {
    return await runner.run(proposalEvaluator, [...])
  } else {
    return await runner.run(webSearchAgent, [...])
  }
}
```

### 4. OpenAI Processing
```
Message + File
    ↓
Guardrails Check
    ├─ PII Detected? → Anonymize
    ├─ Harmful? → Block/Flag
    └─ Safe? → Continue
    ↓
Agent Selection
    ├─ Evaluation keywords? → Proposal Evaluator
    └─ Else → Web Search Agent
    ↓
Agent Execution
    ├─ File Search: Query vector store for context
    ├─ Analyze: Process with reasoning
    └─ Generate: Create structured response
    ↓
Response
```

## Component Architecture

```
ChatInterface.tsx (Main Container)
├─ State Management
│  ├─ messages: Message[]
│  ├─ loading: boolean
│  ├─ uploadedFile: File
│  └─ filePreview: string
│
├─ FileUploader.tsx
│  ├─ Drag & drop area
│  ├─ File type validation
│  └─ Preview generation
│
├─ MessageList.tsx
│  ├─ Display messages
│  ├─ User vs Assistant styling
│  └─ Loading indicator
│
└─ ChatInput.tsx
   ├─ Text input
   ├─ Send button
   └─ Error handling
```

## Workflow Integration Points

### Original Your Workflow Code → New UI Integration

```
ORIGINAL                          NEW INTEGRATION
─────────────────────────────────────────────────────
runWorkflow()          →          /api/chat/route.ts
  ├─ GuardRails        →          Preserved as-is
  ├─ Proposal Eval     →          proposalEvaluator
  └─ Web Search Agent  →          webSearchAgent
```

### Key Modifications Made:

1. **Wrapped in API Route**: Workflow now runs server-side
2. **FormData Handler**: Accepts file + message from UI
3. **Response Format**: Returns JSON for UI rendering
4. **Error Handling**: Catches and formats errors for UI
5. **Async Processing**: Handles async agent operations

## File Structure

```
d:\op/
├─ src/
│  ├─ app/
│  │  ├─ page.tsx              # Home page (renders ChatInterface)
│  │  ├─ layout.tsx            # Root layout with metadata
│  │  └─ globals.css           # Global Tailwind styles
│  │
│  ├─ components/
│  │  ├─ ChatInterface.tsx     # Main component & state
│  │  ├─ FileUploader.tsx      # File upload with validation
│  │  ├─ MessageList.tsx       # Message rendering
│  │  └─ ChatInput.tsx         # Input field
│  │
│  └─ api/
│     └─ chat/
│        └─ route.ts           # Backend: Workflow + Agents
│
├─ public/                      # Static assets
├─ node_modules/               # Dependencies
│
├─ package.json                # Dependencies & scripts
├─ tsconfig.json               # TypeScript config
├─ tailwind.config.js          # Tailwind configuration
├─ next.config.ts              # Next.js configuration
├─ .env.example                # Environment template
│
└─ QUICK_START.md              # Getting started guide
```

## Key Features by Component

### ChatInterface.tsx
- State management for messages and file
- Message scroll-to-bottom logic
- API call orchestration
- File upload handler

### FileUploader.tsx
- Drag & drop support
- File type validation (PDF, PPTX, IMG, TXT)
- Image preview generation
- Error messaging

### MessageList.tsx
- Renders all messages
- User message styling (blue right)
- Assistant message styling (gray left)
- Loading animation
- Timestamp display

### ChatInput.tsx
- Text input field
- Send button with disabled states
- Form submission handling
- Clear input after send

### API Route
- File upload processing
- Guardrails integration
- Agent routing logic
- Response formatting
- Error handling

## Security Considerations

1. **PII Protection**: Guardrails detect and anonymize sensitive data
2. **Content Moderation**: Blocks harmful content before processing
3. **API Key Security**: Stored in `.env.local` (not exposed)
4. **File Validation**: Type and size checks on both client and server
5. **CORS**: API route same-origin by default

## Performance Optimizations

- Client-side file type validation (before upload)
- Streaming UI updates with React state
- Lazy loading of agent responses
- Message virtualization ready (for large conversations)
- CSS-in-JS with Tailwind (minimal bundle)

## Scalability

To handle more users:
1. Deploy on Vercel (auto-scales)
2. Use OpenAI's streaming for real-time responses
3. Add message caching/persistence (database)
4. Implement rate limiting
5. Monitor API usage

## Testing Scenarios

```
Test 1: File Upload
  1. Open http://localhost:3000
  2. Drag PDF onto upload area
  3. Verify preview appears

Test 2: Simple Chat
  1. Type "Hello"
  2. Click Send
  3. Check API response

Test 3: Evaluation
  1. Upload proposal.pdf
  2. Type "Please evaluate this proposal"
  3. Should trigger Proposal Evaluator

Test 4: Web Search
  1. Type "Find info about OpenAI"
  2. Should trigger Web Search Agent

Test 5: PII Detection
  1. Type a message with "SSN: 123-45-6789"
  2. Should be anonymized
```

---

This architecture combines your existing OpenAI workflow with a modern web UI, maintaining all security and functionality while providing an intuitive user experience.
