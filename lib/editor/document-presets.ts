/**
 * Document type presets — pre-configured content templates for each document type.
 * These provide professional starting structures in the Plate.js editor.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PlateNode = any

export interface DocumentPreset {
    type: string
    label: string
    description: string
    defaultTitle: string
    content: PlateNode[]
}

// Use placeholder date to avoid SSR/client hydration mismatch
const today = '[Date]'

export const DOCUMENT_PRESETS: Record<string, DocumentPreset> = {

    contract: {
        type: 'contract',
        label: 'Contract',
        description: 'Numbered sections, definitions, signature blocks',
        defaultTitle: 'Untitled Agreement',
        content: [
            { type: 'h1', children: [{ text: '[AGREEMENT TITLE]' }] },
            { type: 'p', children: [{ text: '' }] },
            { type: 'p', children: [
                { text: 'This Agreement' },
                { text: ' (the "', italic: true },
                { text: 'Agreement', bold: true, italic: true },
                { text: '") ', italic: true },
                { text: `is entered into as of ${today} ("` },
                { text: 'Effective Date', bold: true },
                { text: '"), by and between:' },
            ]},
            { type: 'p', children: [{ text: '' }] },
            { type: 'p', children: [
                { text: '[Party A Full Legal Name]', bold: true },
                { text: ', a [state] [entity type], with its principal place of business at [address] ("' },
                { text: 'Party A', bold: true },
                { text: '"); and' },
            ]},
            { type: 'p', children: [{ text: '' }] },
            { type: 'p', children: [
                { text: '[Party B Full Legal Name]', bold: true },
                { text: ', a [state] [entity type], with its principal place of business at [address] ("' },
                { text: 'Party B', bold: true },
                { text: '").' },
            ]},
            { type: 'p', children: [{ text: '' }] },
            { type: 'hr', children: [{ text: '' }] },
            { type: 'p', children: [{ text: '' }] },

            { type: 'h2', children: [{ text: '1. DEFINITIONS' }] },
            { type: 'p', children: [{ text: '"Confidential Information" means...' }] },
            { type: 'p', children: [{ text: '' }] },

            { type: 'h2', children: [{ text: '2. SCOPE OF AGREEMENT' }] },
            { type: 'p', children: [{ text: '[Describe the purpose and scope of the agreement]' }] },
            { type: 'p', children: [{ text: '' }] },

            { type: 'h2', children: [{ text: '3. TERM AND TERMINATION' }] },
            { type: 'p', children: [{ text: '3.1. This Agreement shall commence on the Effective Date and shall continue for a period of [duration] unless earlier terminated in accordance with this Section.' }] },
            { type: 'p', children: [{ text: '3.2. Either Party may terminate this Agreement upon [notice period] written notice to the other Party.' }] },
            { type: 'p', children: [{ text: '' }] },

            { type: 'h2', children: [{ text: '4. REPRESENTATIONS AND WARRANTIES' }] },
            { type: 'p', children: [{ text: 'Each Party represents and warrants that:' }] },
            { type: 'p', children: [{ text: '(a) It has the authority to enter into this Agreement;' }] },
            { type: 'p', children: [{ text: '(b) The execution of this Agreement does not conflict with any existing obligation.' }] },
            { type: 'p', children: [{ text: '' }] },

            { type: 'h2', children: [{ text: '5. LIMITATION OF LIABILITY' }] },
            { type: 'p', children: [{ text: '[Specify liability caps and exclusions]' }] },
            { type: 'p', children: [{ text: '' }] },

            { type: 'h2', children: [{ text: '6. GOVERNING LAW' }] },
            { type: 'p', children: [{ text: 'This Agreement shall be governed by and construed in accordance with the laws of [jurisdiction].' }] },
            { type: 'p', children: [{ text: '' }] },

            { type: 'hr', children: [{ text: '' }] },
            { type: 'p', children: [{ text: '' }] },

            { type: 'p', children: [
                { text: 'IN WITNESS WHEREOF', bold: true },
                { text: ', the Parties have executed this Agreement as of the date first written above.' },
            ]},
            { type: 'p', children: [{ text: '' }] },

            { type: 'p', children: [{ text: '[Party A Name]', bold: true }] },
            { type: 'p', children: [{ text: 'By: ________________________' }] },
            { type: 'p', children: [{ text: 'Name:' }] },
            { type: 'p', children: [{ text: 'Title:' }] },
            { type: 'p', children: [{ text: 'Date:' }] },
            { type: 'p', children: [{ text: '' }] },

            { type: 'p', children: [{ text: '[Party B Name]', bold: true }] },
            { type: 'p', children: [{ text: 'By: ________________________' }] },
            { type: 'p', children: [{ text: 'Name:' }] },
            { type: 'p', children: [{ text: 'Title:' }] },
            { type: 'p', children: [{ text: 'Date:' }] },
        ],
    },

    memo: {
        type: 'memo',
        label: 'Legal Memo',
        description: 'IRAC format with header block',
        defaultTitle: 'Legal Memorandum',
        content: [
            { type: 'h1', children: [{ text: 'MEMORANDUM' }] },
            { type: 'p', children: [{ text: '' }] },
            { type: 'p', children: [
                { text: 'TO:', bold: true },
                { text: ' [Recipient Name]' },
            ]},
            { type: 'p', children: [
                { text: 'FROM:', bold: true },
                { text: ' [Author Name]' },
            ]},
            { type: 'p', children: [
                { text: 'DATE:', bold: true },
                { text: ` ${today}` },
            ]},
            { type: 'p', children: [
                { text: 'RE:', bold: true },
                { text: ' [Subject Matter]' },
            ]},
            { type: 'p', children: [{ text: '' }] },
            { type: 'hr', children: [{ text: '' }] },
            { type: 'p', children: [{ text: '' }] },

            { type: 'h2', children: [{ text: 'I. QUESTION PRESENTED' }] },
            { type: 'p', children: [{ text: '[State the legal question(s) to be analyzed]' }] },
            { type: 'p', children: [{ text: '' }] },

            { type: 'h2', children: [{ text: 'II. SHORT ANSWER' }] },
            { type: 'p', children: [{ text: '[Provide a concise answer to each question]' }] },
            { type: 'p', children: [{ text: '' }] },

            { type: 'h2', children: [{ text: 'III. STATEMENT OF FACTS' }] },
            { type: 'p', children: [{ text: '[Present the relevant facts objectively]' }] },
            { type: 'p', children: [{ text: '' }] },

            { type: 'h2', children: [{ text: 'IV. DISCUSSION' }] },
            { type: 'h3', children: [{ text: 'A. [First Issue]' }] },
            { type: 'p', children: [{ text: '[Rule → Application → Conclusion]' }] },
            { type: 'p', children: [{ text: '' }] },
            { type: 'h3', children: [{ text: 'B. [Second Issue]' }] },
            { type: 'p', children: [{ text: '[Rule → Application → Conclusion]' }] },
            { type: 'p', children: [{ text: '' }] },

            { type: 'h2', children: [{ text: 'V. CONCLUSION' }] },
            { type: 'p', children: [{ text: '[Summarize findings and provide recommendations]' }] },
        ],
    },

    brief: {
        type: 'brief',
        label: 'Brief / Motion',
        description: 'Court filing with caption and argument headers',
        defaultTitle: 'Untitled Brief',
        content: [
            { type: 'p', children: [{ text: 'IN THE [COURT NAME]', bold: true }] },
            { type: 'p', children: [{ text: '[JURISDICTION]', bold: true }] },
            { type: 'p', children: [{ text: '' }] },

            { type: 'p', children: [{ text: '[Plaintiff/Petitioner Name]', bold: true }] },
            { type: 'p', children: [{ text: '          Plaintiff,' }] },
            { type: 'p', children: [{ text: '' }] },
            { type: 'p', children: [{ text: '     v.                                                                  Case No. [Number]' }] },
            { type: 'p', children: [{ text: '' }] },
            { type: 'p', children: [{ text: '[Defendant/Respondent Name]', bold: true }] },
            { type: 'p', children: [{ text: '          Defendant.' }] },
            { type: 'p', children: [{ text: '' }] },
            { type: 'hr', children: [{ text: '' }] },
            { type: 'p', children: [{ text: '' }] },

            { type: 'h1', children: [{ text: '[TITLE OF MOTION/BRIEF]' }] },
            { type: 'p', children: [{ text: '' }] },

            { type: 'h2', children: [{ text: 'I. INTRODUCTION' }] },
            { type: 'p', children: [{ text: '[Brief overview of the motion and relief sought]' }] },
            { type: 'p', children: [{ text: '' }] },

            { type: 'h2', children: [{ text: 'II. STATEMENT OF FACTS' }] },
            { type: 'p', children: [{ text: '[Relevant factual background]' }] },
            { type: 'p', children: [{ text: '' }] },

            { type: 'h2', children: [{ text: 'III. LEGAL STANDARD' }] },
            { type: 'p', children: [{ text: '[Applicable legal standard for the motion]' }] },
            { type: 'p', children: [{ text: '' }] },

            { type: 'h2', children: [{ text: 'IV. ARGUMENT' }] },
            { type: 'h3', children: [{ text: 'A. [First Argument Heading]' }] },
            { type: 'p', children: [{ text: '[Argument with case law citations]' }] },
            { type: 'p', children: [{ text: '' }] },
            { type: 'h3', children: [{ text: 'B. [Second Argument Heading]' }] },
            { type: 'p', children: [{ text: '[Argument with case law citations]' }] },
            { type: 'p', children: [{ text: '' }] },

            { type: 'h2', children: [{ text: 'V. CONCLUSION' }] },
            { type: 'p', children: [{ text: 'For the foregoing reasons, [Party] respectfully requests that this Court [relief sought].' }] },
            { type: 'p', children: [{ text: '' }] },

            { type: 'p', children: [{ text: 'Respectfully submitted,' }] },
            { type: 'p', children: [{ text: '' }] },
            { type: 'p', children: [{ text: '________________________' }] },
            { type: 'p', children: [{ text: '[Attorney Name]' }] },
            { type: 'p', children: [{ text: '[Bar Number]' }] },
            { type: 'p', children: [{ text: '[Firm Name]' }] },
            { type: 'p', children: [{ text: '[Address]' }] },
            { type: 'p', children: [{ text: '[Phone / Email]' }] },
            { type: 'p', children: [{ text: '' }] },
            { type: 'p', children: [
                { text: `Dated: ${today}`, italic: true },
            ]},
        ],
    },

    letter: {
        type: 'letter',
        label: 'Legal Letter',
        description: 'Professional letter with addressee and closing',
        defaultTitle: 'Untitled Letter',
        content: [
            { type: 'p', children: [{ text: '[Firm/Company Letterhead]', bold: true }] },
            { type: 'p', children: [{ text: '[Address Line 1]' }] },
            { type: 'p', children: [{ text: '[Address Line 2]' }] },
            { type: 'p', children: [{ text: '[Phone] | [Email]' }] },
            { type: 'p', children: [{ text: '' }] },

            { type: 'p', children: [{ text: today }] },
            { type: 'p', children: [{ text: '' }] },

            { type: 'p', children: [{ text: 'VIA [EMAIL/CERTIFIED MAIL/HAND DELIVERY]', bold: true }] },
            { type: 'p', children: [{ text: '' }] },

            { type: 'p', children: [{ text: '[Recipient Name]' }] },
            { type: 'p', children: [{ text: '[Title]' }] },
            { type: 'p', children: [{ text: '[Company Name]' }] },
            { type: 'p', children: [{ text: '[Address]' }] },
            { type: 'p', children: [{ text: '' }] },

            { type: 'p', children: [
                { text: 'Re: ', bold: true },
                { text: '[Subject Matter]' },
            ]},
            { type: 'p', children: [{ text: '' }] },

            { type: 'p', children: [{ text: 'Dear [Recipient Name]:' }] },
            { type: 'p', children: [{ text: '' }] },

            { type: 'p', children: [{ text: '[Opening paragraph — state the purpose of the letter]' }] },
            { type: 'p', children: [{ text: '' }] },

            { type: 'p', children: [{ text: '[Body paragraph — detail the relevant facts, legal analysis, or instructions]' }] },
            { type: 'p', children: [{ text: '' }] },

            { type: 'p', children: [{ text: '[Closing paragraph — state expected action, deadlines, or next steps]' }] },
            { type: 'p', children: [{ text: '' }] },

            { type: 'p', children: [{ text: 'Sincerely,' }] },
            { type: 'p', children: [{ text: '' }] },
            { type: 'p', children: [{ text: '' }] },
            { type: 'p', children: [{ text: '[Your Name]' }] },
            { type: 'p', children: [{ text: '[Title]' }] },
            { type: 'p', children: [{ text: '' }] },

            { type: 'p', children: [
                { text: 'Enclosures:', italic: true },
                { text: ' [List any enclosed documents]', italic: true },
            ]},
            { type: 'p', children: [
                { text: 'cc:', italic: true },
                { text: ' [Names of additional recipients]', italic: true },
            ]},
        ],
    },

    motion: {
        type: 'motion',
        label: 'Motion',
        description: 'Court motion with prayer for relief',
        defaultTitle: 'Untitled Motion',
        content: [
            { type: 'p', children: [{ text: 'IN THE [COURT NAME]', bold: true }] },
            { type: 'p', children: [{ text: 'FOR THE [DISTRICT/DIVISION]', bold: true }] },
            { type: 'p', children: [{ text: '' }] },

            { type: 'p', children: [{ text: '[Moving Party Name]', bold: true }] },
            { type: 'p', children: [{ text: '     v.                                                                  Case No. [Number]' }] },
            { type: 'p', children: [{ text: '[Opposing Party Name]', bold: true }] },
            { type: 'p', children: [{ text: '' }] },
            { type: 'hr', children: [{ text: '' }] },
            { type: 'p', children: [{ text: '' }] },

            { type: 'h1', children: [{ text: 'MOTION TO [TYPE]' }] },
            { type: 'p', children: [{ text: '' }] },

            { type: 'p', children: [{ text: 'NOW COMES [Moving Party], by and through undersigned counsel, and hereby moves this Honorable Court for [relief sought], and in support thereof states as follows:' }] },
            { type: 'p', children: [{ text: '' }] },

            { type: 'h2', children: [{ text: 'FACTUAL BACKGROUND' }] },
            { type: 'p', children: [{ text: '1. [First factual allegation]' }] },
            { type: 'p', children: [{ text: '2. [Second factual allegation]' }] },
            { type: 'p', children: [{ text: '' }] },

            { type: 'h2', children: [{ text: 'LEGAL ARGUMENT' }] },
            { type: 'p', children: [{ text: '3. [Legal argument with supporting authority]' }] },
            { type: 'p', children: [{ text: '' }] },

            { type: 'h2', children: [{ text: 'PRAYER FOR RELIEF' }] },
            { type: 'p', children: [{ text: 'WHEREFORE, [Moving Party] respectfully requests that this Court:' }] },
            { type: 'p', children: [{ text: '(a) [First relief item];' }] },
            { type: 'p', children: [{ text: '(b) [Second relief item]; and' }] },
            { type: 'p', children: [{ text: '(c) Grant such other and further relief as the Court deems just and proper.' }] },
            { type: 'p', children: [{ text: '' }] },

            { type: 'p', children: [{ text: 'Respectfully submitted,' }] },
            { type: 'p', children: [{ text: '' }] },
            { type: 'p', children: [{ text: '________________________' }] },
            { type: 'p', children: [{ text: '[Attorney Name], Esq.' }] },
            { type: 'p', children: [{ text: '[Firm Name]' }] },
            { type: 'p', children: [{ text: `Dated: ${today}` }] },
        ],
    },
}

/**
 * Get preset content for a document type.
 * Returns undefined if no preset exists (falls back to blank editor).
 */
export function getDocumentPreset(type: string): DocumentPreset | undefined {
    return DOCUMENT_PRESETS[type]
}

/**
 * Get all available presets for the "New Draft from Template" UI.
 */
export function getAllPresets(): DocumentPreset[] {
    return Object.values(DOCUMENT_PRESETS)
}
