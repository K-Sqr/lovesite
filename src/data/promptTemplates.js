/**
 * promptTemplates.js — the three prompts the Application Desk assembles.
 *
 * EVERY template must instruct Claude not to invent experience. That rule is
 * non-negotiable and must survive any future edit to this file. If you add a
 * template, it needs the same rule in its own words.
 *
 * Interpolation is `{{token}}` from a flat context object (see
 * buildPrompt() in src/applications.js). Tokens available to every template:
 *
 *   {{position}} {{organization}} {{url}} {{jobDescription}} {{materials}}
 *   {{constraints.tone}} {{constraints.length}}
 *
 * Empty tokens are not rendered as "(none)": a line that held only empty
 * tokens is dropped, and a `## Section` whose body ends up blank is dropped
 * with its heading. `{{position}} at {{organization}}` is handled so that a
 * missing half leaves just the other one.
 *
 * She can edit any body from the page ("Edit this template"); those edits are
 * stored as `templateOverrides` in usm.materials.v2. This file is the default.
 */

/** Which material kinds are pre-checked when a template is picked. */
export const DEFAULT_KINDS_BY_TEMPLATE = {
  resume: ['resume', 'blurb'],
  cover: ['resume', 'blurb', 'coverLetter'],
  references: ['references'],
};

export const TONES = [
  { id: 'warm', label: 'Warm and professional', value: 'warm and professional' },
  { id: 'direct', label: 'Direct', value: 'direct and concise' },
  { id: 'plain', label: 'Plain and clinical', value: 'plain and clinical, no flourish' },
];

export const promptTemplates = [
  {
    id: 'resume',
    label: 'Tailor my resume',
    // Tokens: {{position}} {{organization}} {{url}} {{jobDescription}}
    //         {{materials}} {{constraints.tone}} {{constraints.length}}
    body: `I'm applying for a job and I'd like help tailoring my resume to it.

## The role
{{position}} at {{organization}}
{{url}}

## The job description
"""
{{jobDescription}}
"""

## My materials
{{materials}}

## What I want from you
Rewrite my resume so it speaks directly to this posting.

Rules:
1. Use only the experience, skills, education, and credentials that appear in my
   materials above. Do not invent, upgrade, or imply anything I did not give you.
   If the posting asks for something I have not evidenced, list it at the end
   instead of writing it into the resume.
2. Keep my real job titles, employers, and dates exactly as written.
3. Where the posting's language honestly matches something I actually did, use
   the posting's vocabulary rather than mine.
4. Start each bullet with the action and end with the outcome. Keep the numbers I
   gave you; do not create new ones.
5. Tone: {{constraints.tone}}. Length: {{constraints.length}}.

Give me, in this order: (a) the tailored resume as plain text I can paste into a
document, (b) a short list of what you changed and why, (c) anything in the
posting I do not currently evidence.`,
  },
  {
    id: 'cover',
    label: 'Write a cover letter',
    // Tokens: {{position}} {{organization}} {{url}} {{jobDescription}}
    //         {{materials}} {{constraints.tone}}
    body: `I'm applying for a job and I'd like help writing the cover letter.

## The role
{{position}} at {{organization}}
{{url}}

## The job description
"""
{{jobDescription}}
"""

## My materials
{{materials}}

## What I want from you
Write a cover letter for this specific posting.

Rules:
1. Ground every claim in my materials above. No invented experience, no invented
   metrics, no "passionate about" filler I did not say myself.
2. Name the organization and the role, and say something specific about this
   posting — not something that would fit any employer.
3. Three to four short paragraphs, no more than one page.
4. Tone: {{constraints.tone}}. Write like a person, not like a template.
5. Do not open with "I am writing to express my interest in."

Give me the letter, then two alternative opening paragraphs so I can choose.`,
  },
  {
    id: 'references',
    label: 'Update my references',
    // Tokens: {{position}} {{organization}} {{jobDescription}} {{materials}}
    body: `I need to adapt my references page for a specific application.

## The role
{{position}} at {{organization}}

## The job description
"""
{{jobDescription}}
"""

## My current references block
{{materials}}

## What I want from you
1. Keep every name, title, organization, and contact detail exactly as I wrote
   them. Do not change, reformat, or guess at any contact information.
2. Reorder the references so the most relevant to this posting is first, and tell
   me why you chose that order.
3. For each one, draft a single line describing how they know me and what they can
   speak to — using only what my notes already say. Invent nothing.
4. Flag anyone I should ask for a fresh heads-up before listing them.`,
  },
];

/** @param {string} id */
export function getTemplate(id) {
  return promptTemplates.find((t) => t.id === id) || promptTemplates[0];
}
