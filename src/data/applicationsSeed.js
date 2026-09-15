/**
 * Starter records for the Application Desk, so the first visit is not an empty
 * page. Stable `slug` values become ids (`mat_seed_<slug>`, `app_seed_<slug>`)
 * so a later seed merge can recognise them and not duplicate.
 *
 * Bodies for resumes and cover letters are the files in
 * `src/data/applicationMaterials/`, copied from `public/Resumes/` — the
 * versions she has already used. Do not invent experience when adding more.
 *
 * These texts include contact details that already live in `public/Resumes/`.
 * The repo and the Pages site are public; treat anything here as world-readable.
 */

import resumeResilia from './applicationMaterials/resume-resilia.md?raw';
import coverResilia from './applicationMaterials/cover-resilia.md?raw';
import resumeLabSpecialist from './applicationMaterials/resume-lab-specialist.md?raw';
import coverLabSpecialist from './applicationMaterials/cover-lab-specialist.md?raw';
import resumeResearchAssistant from './applicationMaterials/resume-research-assistant.md?raw';
import coverResearchAssistant from './applicationMaterials/cover-research-assistant.md?raw';
import resumeCaseCoordinator from './applicationMaterials/resume-case-coordinator.md?raw';
import coverCaseCoordinator from './applicationMaterials/cover-case-coordinator.md?raw';
import postingUmLab from './applicationMaterials/posting-um-lab.md?raw';

const TS = {
  older: '2026-08-22T15:00:00.000Z',
  mid: '2026-09-10T12:00:00.000Z',
  recent: '2026-09-12T18:30:00.000Z',
  today: '2026-09-14T12:00:00.000Z',
};

const BLURB_RESILIA = `At Resilia Community Wellness Centre (Newcomer Case Management), January to August 2026, I carried an independent caseload of refugee individuals and families. I conducted eligibility, ongoing, and exit assessments within Resilia criteria, produced triage reports and risk-informed case plans, and documented every contact in CARMIS — case notes, genograms, family ecomaps, and service activity records for program statistics and iCARE reporting.

I coordinated referrals and accompaniment across EIA, Manitoba Housing and Rent Assist, Manitoba Start, Pluri-elles, the Immigrant Centre, school registration, and medical, dental, and vision care, including interpreter-assisted conference calls and home visits. I know the RNCM zones and eligibility criteria, how a high-needs file is carried differently from a low-needs one, and which partner organization to call for which need. I was trained by and worked alongside the coordinator and the case managers, and I have working relationships with the clinicians and community partners this work depends on.

I wrote the RNCM Resource Guide (service provider directory, housing initiatives, child benefit comparison, free tax clinics) and a multi-level English Language Pre-Class Support tool (Levels 1 to 5) for clients on the 6 to 12 month waitlist for government-funded language programs.`;

const BLURB_RESEARCH = `End-to-end human subjects research in psychology: study design, research-ethics-board-approved protocols, participant recruitment and scheduling, data collection, quantitative and qualitative analysis, and writing and presenting findings to academic, government, and community audiences.

Honours thesis (September 2025 to May 2026) on alexithymia and attention-emotion interactions. I built the study in Qualtrics, recruited and scheduled participants, ran collection sessions, cleaned and analysed data in SPSS, and wrote the results for faculty review, keeping detailed records of procedures and measures.

IRCOM Newcomer Youth Participatory Action Research (November 2023 to July 2024): recruited newcomer and refugee youth; designed and ran interviews, focus groups, and surveys on barriers across education and justice systems; analysed the data; presented findings at the IRCOM conference.

TCPS 2: CORE. Summer Institute in Program Evaluation 2026 (Canadian Evaluation Society), including evaluation plans developed for community agencies. Tools: Qualtrics, SPSS, Microsoft Forms, PowerPoint, Nexus, Microsoft Office, generative AI platforms (ChatGPT, Claude, Gemini) for drafting, summarizing, and materials development. I do not have dedicated VR-lab experience.`;

const REFERENCES = `Dr. Stephen Smith, Professor of Psychology, University of Winnipeg, s.smith@uwinnipeg.ca

Aynslie Hinds, Professor of Psychology, University of Winnipeg, a.hinds@uwinnipeg.ca`;

const POSTING_RESILIA = `Resilia Community Wellness Centre is an incorporated, non-profit, charitable organization with its own Board of Directors. Resilia Centre serves the people of Winnipeg and other communities in Manitoba in four major ways: As a United Way agency it offers affordable therapy to couples, families and individuals; It provides the clinical facility where students in the Master of Marriage and Family Therapy (MMFT) program at the University of Winnipeg do the majority of their clinical training; We have a vibrant Newcomer Community Development Program funded through the Government of Canada and the Province of Manitoba that assists newcomers in successful settlement in our community. We lead a unique service model that brings together community, community-based agencies and the formal mental health system in an interdisciplinary team that provides for the needs of newcomers with moderate to severe trauma/PTSD through clinical treatment, cultural healing, trauma informed services and therapy. Resilia Centre strives to be culturally sensitive, inclusive and accessible.

We are seeking:
Term until March 31, 2028
Full-time Case Manager position
Salary Range: $66,000.00 - $72,000.00

Position Overview:
The Case Manager position is to screen and assess newly arrived refugees and connect them with a range of resources to help in their life long successful settlement in Canada. The Case Manager is responsible for performing triage assessments with newly arrived refugees, may also be involved in crisis counselling and with group facilitation. Knowledge and experience related to Trauma, War Trauma, Trauma-informed Care, PTSD, Group facilitation, and working across culture is required.

Duties include:
• Conduct eligibility assessments within Resilia criteria
• Develop case plans for clients to manage and identify risk factors and produce initial case management triage reports.
• Facilitate assessments in line with Resilia's protocols and established best practices.
• Assist and/or accompany clients in referrals to appropriate agencies.
• Refer clients to Resilia clinicians for crisis counselling as needed.
• May include working some evenings and/or weekends.

Qualifications and skills needed:
• Degree in Social Work, Community Development, or a related discipline. Social Work candidates must be registered with the Manitoba College of Social Workers. An equivalent combination of education and work experience may be considered.
• Two (2) years working cross-culturally with diverse immigrant and refugee communities.
• Two (2) years of demonstrated experience in case management.
• Fluency in spoken and written French and/or Arabic is considered an asset; fluency in other languages relevant to Resilia's client populations is also considered an asset.
• Demonstrated understanding and knowledge of the impact of Trauma, War Trauma, and psychological trauma (PTSD) within the newcomer communities.
• Demonstrated understanding of working across culture.
• Strong organizational and communication skills (both written and verbal)
• Demonstrated experience working with immigrants, refugees and interpreters.
• Demonstrated knowledge and experience of refugee process, experiences and supports.
• Fluency in languages relevant to our client populations is considered an asset.
• Demonstrated proficiency in Microsoft Office (Word, Excel, PowerPoint, Outlook), CARMIS and other client databases.
• Demonstrated ability to establish and maintain strong working relationships with others.
• Demonstrated ability to effectively manage multiple priorities and meet deadlines.
• Demonstrated ability in taking initiative and working well under limited supervision and remain calm and composed during stressful/emotionally charged situations.
• Demonstrated ability to maintain confidentiality when dealing with private/sensitive information.`;

const POSTING_CASTLEMAIN = `Administrator, Workplace Health & Safety
Job Category: Community Program Design & Delivery
Requisition Number: ADMIN001322

Castlemain
Winnipeg (preferred), Calgary, or Vancouver — Hybrid; remote available
Full-time, Permanent
Reports to: Director, Workplace Health & Safety
Language requirements: English; French is an asset
Salary: $60,000 – $69,000

About Castlemain
At Castlemain, we collaborate with communities and organizations to enhance capacity and amplify underrepresented voices. We partner with clients dedicated to addressing historical injustices and fostering better pathways forward. Our approach is culturally sensitive and trauma-informed, inspired by the strong communities and relationships we engage with daily.

Position overview
Reporting to the Director, Workplace Health & Safety, the Administrator, Workplace Health & Safety provides administrative and operational support to ensure the efficient and effective delivery of Castlemain's health and safety program. The Administrator plays a key role in assisting with the implementation of health and safety initiatives across the organization. Main duties include coordinating with senior leadership, employees, and stakeholders to support health and safety initiatives, policies, and approaches to improve and nurture a positive safety culture. The Administrator is also responsible to review, evaluate and monitor incident reports, and assist employees to identify and implement appropriate corrective actions.

Key responsibilities
• In conjunction with the Director, Health & Safety, assist the design and deployment of comprehensive safety programs founded on sound data analysis and industry best practices that are trauma-informed and culturally safe.
• Foster and support a positive safety culture across all levels of the organization by assisting to develop clear policies, procedures, and processes that are practical and actionable in day-to-day operations.
• Coordinate input from internal stakeholders (Corporate Operations, People Team, IT Team, Program Leads, Wellness and Training Team) to continuously improve health and safety strategies across the organization.
• Assist with incident investigation, including root cause analysis, and identification and implementation of corrective actions to prevent recurrence.
• Coordinate joint health and safety committees across provinces and territories.
• Provide regular support and guidance to employees, managers, and leadership to assist with their understanding of safe work procedures, risk assessments, and other protocols to confirm safe travel planning. May also facilitate safety and health orientation and onboarding.
• Contribute to training, onboarding, inspections, audits, and ongoing health and safety communications.

Qualifications
• Certificate, Diploma or Degree in Occupational Health and Safety or a related field, or an equivalent combination of education and experience.
• Working knowledge of applicable provincial and territorial Occupational Health and Safety legislation, regulations, and standards.
• Minimum 2 years' experience providing administrative or program support in occupational health and safety, human resources or related field.
• Proficiency in Microsoft Office (Word, Excel, Outlook, and PowerPoint), with strong skills in document preparation and record management.
• Strong communication skills.
• Willingness to travel occasionally, as required.`;

/**
 * Materials library. Order is KIND_ORDER in applicationsStore (resume, blurb,
 * cover letter, references, other); within a kind, newer updatedAt first.
 */
export const materialsSeed = [
  {
    slug: 'resume-resilia',
    label: 'Resume — Resilia Case Manager',
    kind: 'resume',
    body: resumeResilia,
    updatedAt: TS.recent,
  },
  {
    slug: 'resume-lab-specialist',
    label: 'Resume — Research & Lab Support',
    kind: 'resume',
    body: resumeLabSpecialist,
    updatedAt: TS.mid,
  },
  {
    slug: 'resume-research-assistant',
    label: 'Resume — Research Assistant (Psychiatry)',
    kind: 'resume',
    body: resumeResearchAssistant,
    updatedAt: TS.older,
  },
  {
    slug: 'resume-case-coordinator',
    label: 'Resume — Newcomer Case Coordinator',
    kind: 'resume',
    body: resumeCaseCoordinator,
    updatedAt: TS.older,
  },
  {
    slug: 'blurb-resilia-ops',
    label: 'Experience note — Resilia daily operations',
    kind: 'blurb',
    body: BLURB_RESILIA,
    updatedAt: TS.recent,
  },
  {
    slug: 'blurb-research',
    label: 'Experience note — Human subjects research',
    kind: 'blurb',
    body: BLURB_RESEARCH,
    updatedAt: TS.mid,
  },
  {
    slug: 'cover-resilia',
    label: 'Cover letter — Resilia Case Manager',
    kind: 'coverLetter',
    body: coverResilia,
    updatedAt: TS.recent,
  },
  {
    slug: 'cover-lab-specialist',
    label: 'Cover letter — Research & Lab Support',
    kind: 'coverLetter',
    body: coverLabSpecialist,
    updatedAt: TS.mid,
  },
  {
    slug: 'cover-research-assistant',
    label: 'Cover letter — Research Assistant (Psychiatry)',
    kind: 'coverLetter',
    body: coverResearchAssistant,
    updatedAt: TS.older,
  },
  {
    slug: 'cover-case-coordinator',
    label: 'Cover letter — Newcomer Case Coordinator',
    kind: 'coverLetter',
    body: coverCaseCoordinator,
    updatedAt: TS.older,
  },
  {
    slug: 'references',
    label: 'References',
    kind: 'references',
    body: REFERENCES,
    updatedAt: TS.mid,
  },
];

/**
 * Tracker records. Castlemain is Saved so the first action on the list is
 * "Prepare this one". Resilia is the one she recently sent. The UM lab role
 * is an earlier applied package, using the Tech 4 posting and the materials
 * written for it.
 */
export const applicationsSeed = [
  {
    slug: 'castlemain-whs',
    organization: 'Castlemain',
    position: 'Administrator, Workplace Health & Safety',
    url: 'https://www.castlemain.com/about/careers/',
    jobDescription: POSTING_CASTLEMAIN,
    deadline: null,
    discoveredAt: '2026-09-14',
    appliedAt: null,
    status: 'Saved',
    resumeUsed: null,
    coverLetter: null,
    referencesUsed: 'mat_seed_references',
    interviewAt: null,
    followUpAt: null,
    notes: 'Requisition ADMIN001322. Community Program Design & Delivery. Winnipeg preferred, hybrid. Paste any extra posting text here before you prepare.',
    outcome: null,
    updatedAt: TS.today,
  },
  {
    slug: 'resilia-case-manager',
    organization: 'Resilia Community Wellness Centre',
    position: 'Case Manager',
    url: '',
    jobDescription: POSTING_RESILIA,
    deadline: null,
    discoveredAt: '2026-09-08',
    appliedAt: '2026-09-12',
    status: 'Applied',
    resumeUsed: 'mat_seed_resume-resilia',
    coverLetter: 'mat_seed_cover-resilia',
    referencesUsed: 'mat_seed_references',
    interviewAt: null,
    followUpAt: null,
    notes: 'Term until March 31, 2028. Full-time. I was Newcomer Case Manager here January–August 2026; applying to return.',
    outcome: null,
    updatedAt: TS.recent,
  },
  {
    slug: 'um-lab-support',
    organization: 'University of Manitoba',
    position: 'Research & Laboratory Support Specialist – Tech 4',
    url: '',
    jobDescription: postingUmLab,
    deadline: null,
    discoveredAt: '2026-08-06',
    appliedAt: '2026-08-22',
    status: 'Applied',
    resumeUsed: 'mat_seed_resume-lab-specialist',
    coverLetter: 'mat_seed_cover-lab-specialist',
    referencesUsed: 'mat_seed_references',
    interviewAt: null,
    followUpAt: null,
    notes: 'Position 36076. Centre for Advancement of Teaching and Learning. Posted August 5, 2026.',
    outcome: null,
    updatedAt: TS.older,
  },
];
