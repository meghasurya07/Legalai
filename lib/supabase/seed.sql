-- Seed static workflows data
-- These are the 9 predefined expert workflows

INSERT INTO workflows (id, title, description, icon) VALUES
('redline-analysis', 'Redline analysis', 'Redline Analysis generates a chart comparing the original and revised version of a redline document. It also helps you identify or generate a response to your query based on the redline document.', 'FileCheck'),
('company-profile', 'Company profile', 'Company Profile will generate a report on any NYSE or NASDAQ listed company that files 10-Ks with the SEC by searching and summarizing publicly available data such as EDGAR.', 'FileText'),
('document-comparison', 'Document comparison', 'Document Comparison will describe the difference between two documents with vastly different formats but with overlapping substance.', 'Copy'),
('transcripts', 'Transcripts', 'Transcripts surfaces and summarizes key themes from your trial and deposition transcripts. It also allows users to query those transcripts to further develop key themes and additional insights.', 'FileSignature'),
('translation', 'Translate into Another Language', 'Instantly translate legal documents, contracts, and communications into multiple languages while maintaining legal terminology accuracy and context.', 'Languages'),
('draft-from-template', 'Draft from Template', 'Generate legal documents from pre-approved templates. Customize contracts, agreements, and legal letters with your specific requirements and client information.', 'FileEdit'),
('client-alert', 'Draft a Client Alert', 'Create professional client alerts and legal updates. Communicate important legal developments, regulatory changes, and case updates to your clients effectively.', 'FileWarning'),
('legal-memo', 'Draft Memo from Legal Research', 'Transform legal research into comprehensive memorandums. Analyze case law, statutes, and regulations to create well-structured legal memos for your cases.', 'Gavel'),
('contract-analysis', 'Contract Analysis', 'Perform deep analysis of contracts to identify key clauses, obligations, risks, and opportunities. Extract important dates, parties, and terms with AI-powered precision.', 'ScanSearch')
ON CONFLICT (id) DO NOTHING;
