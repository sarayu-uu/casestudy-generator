export type CaseStudySection =
  | "titleAbstract"
  | "introduction"
  | "problemStatement"
  | "solutionInnovation"
  | "businessModel"
  | "challengesRisks"
  | "growthAchievements"
  | "impactFuture"
  | "conclusion"
  | "references"
  | "presentation";

type PromptTemplate = {
  section: CaseStudySection;
  title: string;
  buildPrompt: (topic: string) => string;
};

const SHARED_TONE =
  "Write in clear business prose, balancing narrative with concise bullet points where appropriate.";
const SHARED_CONSTRAINTS =
  "Stay within 400 words per section and avoid exceeding 5,000 output tokens overall.";

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    section: "titleAbstract",
    title: "Title & Abstract",
    buildPrompt: (topic) =>
      `You are drafting a case study about ${topic}.
${SHARED_TONE}
${SHARED_CONSTRAINTS}
Return:
1. A compelling case study title on a single line.
2. An abstract labeled "Abstract:" with exactly 3 sentences (~80 words total) summarizing who, what, and outcome.
Paragraph constraint: 1 paragraph only.`,
  },
  {
    section: "introduction",
    title: "Introduction",
    buildPrompt: (topic) =>
      `Write the introduction for a case study on ${topic}.
${SHARED_TONE}
${SHARED_CONSTRAINTS}
Cover founding story, mission, founding team, and early context.
Paragraph/bullet constraints:
- 2 short paragraphs describing the story and context.
- Optional 1 bullet list for key dates or milestones.`,
  },
  {
    section: "problemStatement",
    title: "Problem Statement",
    buildPrompt: (topic) =>
      `Detail the primary problem ${topic} set out to solve.
${SHARED_TONE}
${SHARED_CONSTRAINTS}
Explain stakeholders affected, root causes, and measurable pain points. Include one quantified data point if available.
Paragraph/bullet constraints:
- Up to 2 paragraphs maximum.
- Optional 1 short bullet list for key causes or data.`,
  },
  {
    section: "solutionInnovation",
    title: "Solution / Innovation",
    buildPrompt: (topic) =>
      `Describe ${topic}'s solution or innovation.
${SHARED_TONE}
${SHARED_CONSTRAINTS}
Outline the product/service, unique differentiators, delivery approach, and supporting partnerships.
Paragraph/bullet constraints:
- 1–2 short paragraphs describing the solution.
- Followed by a bullet list (3–5 bullets) for feature highlights.`,
  },
  {
    section: "businessModel",
    title: "Business Model",
    buildPrompt: (topic) =>
      `Summarize the business model for ${topic}.
${SHARED_TONE}
${SHARED_CONSTRAINTS}
Include revenue streams, pricing approach, key customer segments, distribution, and unit economics or KPIs when available.
Paragraph/bullet constraints:
- 2 paragraphs maximum.
- Optional bullet list (up to 5 bullets) for KPIs or monetization highlights.`,
  },
  {
    section: "challengesRisks",
    title: "Challenges & Risks",
    buildPrompt: (topic) =>
      `List major challenges and risks encountered by ${topic}.
${SHARED_TONE}
${SHARED_CONSTRAINTS}
Cover operational hurdles, market threats, regulatory issues, or internal gaps. Provide mitigation steps or lessons learned for each bullet.
Paragraph/bullet constraints:
- 1 short introductory paragraph.
- Bullet list (4–6 bullets), each describing a risk and mitigation.`,
  },
  {
    section: "growthAchievements",
    title: "Growth & Achievements",
    buildPrompt: (topic) =>
      `Highlight growth milestones for ${topic}.
${SHARED_TONE}
${SHARED_CONSTRAINTS}
Document traction metrics, product milestones, fundraising, partnerships, awards, or user growth.
Paragraph/bullet constraints:
- 1 short summary paragraph.
- Bullet list (5–7 bullets) with concrete numbers or achievements.`,
  },
  {
    section: "impactFuture",
    title: "Impact & Future Plans",
    buildPrompt: (topic) =>
      `Explain the broader impact of ${topic} and near-term roadmap.
${SHARED_TONE}
${SHARED_CONSTRAINTS}
Address social, economic, or industry impact plus upcoming initiatives or expansion plans.
Paragraph/bullet constraints:
- Up to 4 short paragraphs:
  1 for impact, 1 for future initiatives, 2 optional for industry influence.`,
  },
  {
    section: "conclusion",
    title: "Conclusion",
    buildPrompt: (topic) =>
      `Provide a concise conclusion for the ${topic} case study.
${SHARED_TONE}
${SHARED_CONSTRAINTS}
Summarize critical takeaways, strategic lessons, and advice for similar ventures.
Paragraph/bullet constraints:
- Exactly 2 short paragraphs:
  1 for key outcomes, 1 for broader lessons/advice.`,
  },
  {
    section: "references",
    title: "References",
    buildPrompt: (topic) =>
      `List 3-5 credible references for researching ${topic}.
${SHARED_TONE}
${SHARED_CONSTRAINTS}
Return them as a markdown bullet list with title, publisher, year, and URL when possible. Include at least one primary source if available.
Paragraph/bullet constraints:
- No paragraphs; use a bullet list (5-6 items).`,
  },
  {
    section: "presentation",
    title: "Presentation",
    buildPrompt: (topic) =>
      `Draft a short presentation outline for a case study on ${topic}.
${SHARED_TONE}
${SHARED_CONSTRAINTS}
Include 8 key slides or talking points, summarizing the most important aspects of the case study.
Paragraph/bullet constraints:
- Use bullets or numbered points for each slide.
- Keep each slide have concise point concise (3-4 lines).`,
  },
];
