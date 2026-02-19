import { NextRequest, NextResponse } from 'next/server';
import { fileSearchTool, Agent, AgentInputItem, Runner, withTrace } from "@openai/agents";
import { OpenAI } from "openai";
import { runGuardrails } from "@openai/guardrails";

// ────────────────────────────────────────────────
// Tool definitions
// ────────────────────────────────────────────────
const VECTOR_STORE_ID = "vs_69957e2424d88191999bfe86e31a849e";

const fileSearch = fileSearchTool([
  VECTOR_STORE_ID
]);

// Shared client
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ────────────────────────────────────────────────
// Guardrails config
// ────────────────────────────────────────────────
const guardrailsConfig = {
  guardrails: [
    {
      name: "Contains PII",
      config: { block: false, detect_encoded_pii: true, entities: ["CREDIT_CARD", "US_BANK_NUMBER", "US_PASSPORT", "US_SSN"] }
    },
    {
      name: "Moderation",
      config: { categories: ["sexual/minors", "hate/threatening", "harassment/threatening", "self-harm/instructions", "violence/graphic", "illicit/violent"] }
    }
  ]
};

const context = { guardrailLlm: client };

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function waitForVectorStoreFile(
  vectorStoreId: string,
  vectorStoreFileId: string,
  timeoutMs = 30000,
  intervalMs = 1000
) {
  if (!vectorStoreId || !vectorStoreFileId) {
    return null;
  }

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const status = await client.vectorStores.files.retrieve(vectorStoreId, vectorStoreFileId);
      if (status.status === "completed" || status.status === "failed") {
        return status;
      }
    } catch {
      return null;
    }
    await sleep(intervalMs);
  }

  return null;
}

// ────────────────────────────────────────────────
// Guardrail helper functions (mirroring Python closely)
// ────────────────────────────────────────────────
function guardrailsHasTripwire(results: any[] = []): boolean {
  return results.some(r => r?.tripwireTriggered === true);
}

function getGuardrailSafeText(results: any[] = [], fallbackText: string): string {
  for (const r of results) {
    const info = r?.info ?? {};
    if ("checked_text" in info) {
      return info.checked_text ?? fallbackText;
    }
  }

  const pii = results.find(r => {
    const info = r?.info ?? {};
    return "anonymized_text" in info;
  });

  if (pii?.info && "anonymized_text" in pii.info) {
    return pii.info.anonymized_text ?? fallbackText;
  }

  return fallbackText;
}

async function scrubConversationHistory(history: any[], config: any): Promise<void> {
  try {
    const guardrails = config?.guardrails ?? [];
    const pii = guardrails.find((g: any) => g?.name === "Contains PII");
    if (!pii) return;

    const piiOnly = { guardrails: [pii] };

    for (const msg of history ?? []) {
      const content = Array.isArray(msg?.content) ? msg.content : [];
      for (const part of content) {
        if (
          part &&
          typeof part === "object" &&
          part.type === "input_text" &&
          typeof part.text === "string"
        ) {
          const res = await runGuardrails(part.text, piiOnly, context, true);
          part.text = getGuardrailSafeText(res, part.text);
        }
      }
    }
  } catch {
    // silent fail like Python
  }
}

async function scrubWorkflowInput(workflow: any, inputKey: string, config: any): Promise<void> {
  try {
    const guardrails = config?.guardrails ?? [];
    const pii = guardrails.find((g: any) => g?.name === "Contains PII");
    if (!pii || typeof workflow !== "object") return;

    const value = workflow[inputKey];
    if (typeof value !== "string") return;

    const piiOnly = { guardrails: [pii] };
    const res = await runGuardrails(value, piiOnly, context, true);
    workflow[inputKey] = getGuardrailSafeText(res, value);
  } catch {
    // silent
  }
}

async function runAndApplyGuardrails(inputText: string, config: any, history: any[], workflow: any) {
  const results = await runGuardrails(inputText, config, context, true);

  const guardrails = config?.guardrails ?? [];
  const maskPii = guardrails.some(
    (g: any) => g?.name === "Contains PII" && g?.config?.block === false
  );

  if (maskPii) {
    await scrubConversationHistory(history, config);
    await scrubWorkflowInput(workflow, "input_as_text", config);
    await scrubWorkflowInput(workflow, "input_text", config);
  }

  const hasTripwire = guardrailsHasTripwire(results);
  const safeText = getGuardrailSafeText(results, inputText);

  return {
    results,
    hasTripwire,
    safeText,
    failOutput: buildGuardrailFailOutput(results ?? []),
    passOutput: { safe_text: safeText || inputText }
  };
}

function buildGuardrailFailOutput(results: any[]) {
  const getGuardrail = (name: string) =>
    results.find(r => {
      const info = r?.info ?? {};
      const gname = info.guardrail_name ?? info.guardrailName;
      return gname === name;
    });

  const pii    = getGuardrail("Contains PII");
  const mod    = getGuardrail("Moderation");
  const jb     = getGuardrail("Jailbreak");
  const hal    = getGuardrail("Hallucination Detection");
  const nsfw   = getGuardrail("NSFW Text");
  const url    = getGuardrail("URL Filter");
  const custom = getGuardrail("Custom Prompt Check");
  const pid    = getGuardrail("Prompt Injection Detection");

  const detectedEntities = pii?.info?.detected_entities ?? {};
  const piiCounts = Object.entries(detectedEntities)
    .filter(([, v]) => Array.isArray(v))
    .map(([k, v]) => `${k}:${(v as any[]).length}`);

  const flaggedCategories = mod?.info?.flagged_categories ?? [];

  return {
    pii: {
      failed: piiCounts.length > 0 || pii?.tripwireTriggered === true,
      detected_counts: piiCounts
    },
    moderation: {
      failed: mod?.tripwireTriggered === true || flaggedCategories.length > 0,
      flagged_categories: flaggedCategories
    },
    jailbreak: { failed: jb?.tripwireTriggered === true },
    hallucination: {
      failed: hal?.tripwireTriggered === true,
      reasoning: hal?.info?.reasoning,
      hallucination_type: hal?.info?.hallucination_type,
      hallucinated_statements: hal?.info?.hallucinated_statements,
      verified_statements: hal?.info?.verified_statements
    },
    nsfw: { failed: nsfw?.tripwireTriggered === true },
    url_filter: { failed: url?.tripwireTriggered === true },
    custom_prompt_check: { failed: custom?.tripwireTriggered === true },
    prompt_injection: { failed: pid?.tripwireTriggered === true }
  };
}

// ────────────────────────────────────────────────
// Agents — with FULL instructions from your Python code
// ────────────────────────────────────────────────
const proposalEvaluator = new Agent({
  name: "Proposal Evaluator",
  instructions: `You are a strict, evidence-based evaluator of uploaded documents (PPTX, PDF, image sequence, or text document). Your task is to perform a detailed analysis of the uploaded file against the provided multi-criteria rubric, ensuring each judgment is grounded solely in visible evidence with clear slide/page/frame references. Do not make any assumptions or interpretations outside what is explicitly shown in the document. Neutrality, consistency, and fairness are paramount; penalize vagueness, missing evidence, and structure gaps. Follow the full evaluation process, step-by-step, as outlined:

# Steps
1. **Preparation and Scanning**
    - Scan the entire document end-to-end for structure: count slides/pages/frames, note section headings, and identify visuals (charts, timelines, tables, diagrams).
    - On a second pass, read deeply, extracting exact headings, bullets, captions, and noting presence/clarity of visuals (axes/labels/legends/units).

2. **Evidence and Indexing**
    - For each slide/page/frame, index explicit evidence (e.g., "Slide 2: Problem statement...").
    - Do not infer or interpret unstated intentions, causes, or data.

3. **Criterion-Based Scoring**
    - Analyze and score each of the following five criteria independently using the explicit rubrics below, citing specific evidence for each:
        - **A. Problem Statement (0–10):** Clarity, context, supporting data, and explicit identification.
        - **B. Solution Clarity (0–10):** Clear description, structure, logical flow, visual support.
        - **C. Feasibility (0–10):** Implementation details, resourcing, technical specifics, evidence of readiness.
        - **D. Impact & ROI (0–10):** Quantified outcomes, measurement plans, linkage to solution mechanisms.
        - **E. Design & Storytelling (0–10):** Visual consistency, readability, professional design, narrative flow.
    - For each criterion, provide a score per rubric (with strict adherence to prescribed score ranges/penalties) and a reasoned justification referencing the indexed document evidence.

4. **Strict Use of Evidence**
    - Whenever scoring, cite slide/page/frame numbers and direct quotes or paraphrases.
    - Penalize missing, unclear, or implied content as detailed in the rubrics.
    - State explicitly if content is illegible, missing, or unclear, and penalize accordingly.

5. **Scoring Mechanics**
    - Assign an integer score (0–10) to each criterion without rounding up artificially.
    - Calculate the final weighted score as the simple average of the five criteria, rounded to one decimal place.

6. **Executive Summary**
    - After scoring, synthesize your findings in an executive summary that:
        - States overall quality in 1–2 sentences based on scores.
        - Cites STRENGTHS and WEAKNESSES, referencing precise slide numbers and evidence.
        - Lists clear, actionable AREAS FOR IMPROVEMENT tied to the document and rubric.

7. **Handling File Types and Quality**
    - For non-text or image-based PDFs: treat each image or frame as a page, extract all visible content.
    - If content is illegible (e.g., low-quality scan, missing text): note the limitation, penalize impacted criteria.

8. **Enforce Complete Neutrality**
    - Use professional, non-emotive language.
    - Refuse to speculate about missing or implied data. Favor penalization for every gap per the rubric.

# Output Format
Strictly use the following output template, without altering its structure:
Evaluation Report
------------------
1. Problem Statement: X/10
 - Evidence-based Reason:
2. Solution Clarity: X/10
 - Evidence-based Reason:
3. Feasibility: X/10
 - Evidence-based Reason:
4. Impact & ROI: X/10
 - Evidence-based Reason:
5. Design & Storytelling: X/10
 - Evidence-based Reason:
Final Weighted Score: X/10

Executive Summary:
- Overall Quality: The document partially meets expectations, with strong visual coherence but lacks depth in feasibility, metrics, and supporting evidence.
- Strengths: Slide 2 provides data on churn; slides 1–7 maintain consistent design.
- Weaknesses: Slide 6 lacks a timeline and owner assignments; slide 7 omits quantified impact.
- Areas of Improvement: Add a detailed, dated timeline (Slide 6); quantify cost savings (Slide 7); define all acronyms (Slides 4–5).

(Real examples should be custom to the user's uploaded document and should cite actual content and slide/page numbers.)

# Notes

- Absolutely no assumptions: missing, ambiguous, or implied information must be treated as gaps, not as partial evidence.
- If any slide/page/frame is illegible or incomplete, declare the limitation and reflect it in the relevant score(s).
- Use the provided output structure and scoring method without modification.
- Always explain your reasoning before assigning scores—in your justifications, not as a separate section.
- In Title slide the left logo represent Unlimited Innovations which is not client, the right side logo which has been used as client logo and subtitle of the first slide represent the client name. based on this provide information about the client

**Reminder:** Your primary duties are to evaluate explicit content only, score strictly according to the rubric, and cite all evidence by location, presenting your findings in the mandated format with step-by-step justification for every score.

Also please analyse that the uploaded PDF has these contents in the slides
This PowerPoint template offers multiple slide layouts to accommodate various presentation needs. Please adhere to the followingguidelines when creating decks:​
Do not make edits in the template or in the Slide Master. Always make a copy of this deck for your own needs.​
Aim to use 17+ font size. Avoid text smaller than 12, with the exception of tables, graphs, and​ footnotes (as appropriate).​
Use the theme fonts and colors for consistency.​​
Slide title text font is Open Sans Light. Subheader text font is Open Sans Bold, and body text font is Open Sans Regular. Slide titles are in titlecase, and subheaders and body text are in sentence case.​
Slide titles and subheaders use font color “Blue” HEX #0059B8 unless it’s on a dark background, in which case it should be the font color“Light” HEX #F3F5F5​
Slide body copy use font color “Ink” HEX #1F2020 unless it’s on a dark background, in which case it should be the font color “Light” HEX#F3F5F5​
The icon and graph colors can be changed as long as it’s within the template’s color palette​
When copying and pasting content from other decks, avoid copying the entire slide. Copy only the slide content (text boxes, images, etc.) and rightclick to paste using “Use Destination Theme” in the deck.​
​
Contact the Marketing team if you have feedback or if you have ideas for additional slide layouts.​
​
also the prompt and ask that which region it is for if it is US the first slide need to be with UB Technology Innovations and If India then Unlimited Innovations and if it is UAE then UB Infinite solutions and then finally after the Improvement section give section for slide template evaluation score based on the match and if there is deviation then need to showcase the points. 

And you need to be interactive and responsive for previous questions and maintain memory for further answer based on the questions from the uploaded file`,

  model: "gpt-5.2",
  tools: [fileSearch],
  modelSettings: {
    store: true,
    reasoning: {
      effort: "low",
      summary: "auto"
    }
  }
});

const webSearchAgent = new Agent({
  name: "Web search Agent",
  instructions: `Provide helpful assistance by searching the web for necessary and up-to-date information about a given search query. For example, if a user inquires about a company, research recent and reliable online sources to gather comprehensive details, then present the results in a clear, well-structured table format. Include all relevant information such as:
- Company overview/about
- Recent revenue figures (state the year)
- Number of employees (most recent figure available)
- Founding year & location
- Key executives/leadership
- Headquarters location
- Main products/services
- Any notable awards or achievements
- Website URL

If additional pertinent or commonly requested information is found (e.g., market cap, major acquisitions), include this as well. Always cite the source for each data point in the table with a direct link or short reference.

### Steps:
1. Identify the precise subject or entity of the query.
2. Search credible online sources for current, relevant information.
3. Organize the data clearly into a table with labeled rows and columns.
4. Cite the original source(s) for each data point in-footnotes or as hyperlinks within the table.
5. Only provide information that is supported by a verifiable source. Clearly indicate if any requested detail is unavailable.

### Output Format:
- Response: A single, well-formatted markdown table summarizing all collected data.
- Length: Table should be concise but as complete as possible, typically 8-12 rows.
- Sources must appear as hyperlinks within each table cell or a footnote below the table.

### Example:

**Input:**  
Company: [PLACEHOLDER_COMPANY]

**Output:**

| Field               | Details                                         | Source            |
|---------------------|-------------------------------------------------|-------------------|
| Company Name        | [Company ABC]                                   | [website](link)   |
| Overview            | [Short description]                             | [source](link)    |
| Revenue (2023)      | $[X] Billion                                    | [source](link)    |
| Employees (2024)    | [X,XXX]                                         | [source](link)    |
| Founded             | 19XX, [Location]                                | [source](link)    |
| CEO                 | [Name]                                          | [source](link)    |
| Headquarters        | [City, Country]                                 | [source](link)    |
| Main Products       | [Product/Service A, B]                          | [source](link)    |
| Market Cap (2024)   | $[XX] Billion                                   | [source](link)    |
| Website             | [company.com](link)                             | [website](link)   |

(All real responses should be longer and more detailed than the example above, using actual up-to-date data and sources.)

### Important Considerations
- Always verify information is current and from reliable sources.
- Skip any fields you cannot confidently verify, and indicate as \"Not available.\"
- Adhere strictly to the markdown table format, with sources hyperlinked when possible..`,

  model: "gpt-5.2",
  modelSettings: {
    store: true,
    reasoning: {
      effort: "low",
      summary: "auto"
    }
  }
});

// ────────────────────────────────────────────────
// Workflow types & main logic
// ────────────────────────────────────────────────
type WorkflowInput = { input_as_text: string };

async function runWorkflow(workflow: WorkflowInput) {
  return await withTrace("Proposal Evaluator", async () => {
    const conversationHistory: AgentInputItem[] = [
      {
        role: "user",
        content: [{ type: "input_text", text: workflow.input_as_text }]
      }
    ];

    const guardrailsInputText = workflow.input_as_text;
    const guardrailResult = await runAndApplyGuardrails(
      guardrailsInputText,
      guardrailsConfig,
      conversationHistory,
      workflow
    );

    if (guardrailResult.hasTripwire) {
      return guardrailResult.failOutput;
    }

    const evaluationTriggers = [
      "evaluate", "Evaluate",
      "analyse", "Analyse",
      "assessment", "Assessment",
      "review", "Review",
      "check", "Check",
      "inspect", "Inspect",
      "test", "Test",
      "validate", "Validate",
      "verify", "Verify",
      "examine", "Examine",
      "scrutinize", "Scrutinize",
      "audit", "Audit"
    ];

    const isEvaluationRequest = evaluationTriggers.includes(workflow.input_as_text.trim());

    const runner = new Runner({
      traceMetadata: {
        __trace_source__: "agent-builder",
        workflow_id: "wf_6995798aa648819081ebbbb27d899f550d41e630ed9d94c6"
      }
    });

    if (isEvaluationRequest) {
      const result = await runner.run(proposalEvaluator, [...conversationHistory]);
      conversationHistory.push(...result.newItems.map(item => item.rawItem));
      return {
        output_text: result.finalOutput ?? "No evaluation result"
      };
    } else {
      const result = await runner.run(webSearchAgent, [...conversationHistory]);
      conversationHistory.push(...result.newItems.map(item => item.rawItem));
      return {
        output_text: result.finalOutput ?? "No response received"
      };
    }
  });
}

// ────────────────────────────────────────────────
// Next.js API Route Handler
// ────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const message = (formData.get('message') as string) || 'evaluate';
    const file = formData.get('file') as File | null;
    let openAiFileId: string | undefined;
    let vectorStoreFileId: string | undefined;
    let vectorStoreFileStatus: string | undefined;

    if (file) {
      console.log(`File received: ${file.name} (${file.size} bytes)`);

      const bytes = new Uint8Array(await file.arrayBuffer());
      const uploadFile = new File([bytes], file.name, {
        type: file.type || 'application/octet-stream'
      });

      const uploaded = await client.files.create({
        file: uploadFile,
        purpose: 'assistants'
      });

      openAiFileId = uploaded.id;

      const vectorStoreFile = await client.vectorStores.files.create(
        VECTOR_STORE_ID,
        { file_id: openAiFileId }
      );

      vectorStoreFileId = vectorStoreFile.id;
      const ready = await waitForVectorStoreFile(VECTOR_STORE_ID, vectorStoreFileId);
      vectorStoreFileStatus = ready?.status ?? vectorStoreFile.status ?? "unknown";
      console.log(`Uploaded to OpenAI: ${openAiFileId} | Vector store file: ${vectorStoreFileId}`);
    }

    const workflow: WorkflowInput = { input_as_text: message };

    const result = await runWorkflow(workflow);

    return NextResponse.json({
      success: true,
      output: result.output_text,
      raw: result,
      file: file
        ? {
            name: file.name,
            size: file.size,
            type: file.type,
            openai_file_id: openAiFileId,
            vector_store_file_id: vectorStoreFileId,
            vector_store_status: vectorStoreFileStatus
          }
        : null,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error("Workflow error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal server error"
      },
      { status: 500 }
    );
  }
}