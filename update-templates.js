const fs = require('fs');
const path = require('path');

const dir = 'c:/product/components';
const templateComponents = [
    'client-alert.tsx', 'company-profile.tsx', 'contract-analysis.tsx',
    'document-comparison.tsx', 'draft-from-template.tsx', 'legal-memo.tsx',
    'redline-analysis.tsx', 'transcripts.tsx', 'translation.tsx'
];

templateComponents.forEach(file => {
    const filePath = path.join(dir, file);
    if (!fs.existsSync(filePath)) return;
    
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace import
    content = content.replace(
        /import\s+\{\s*useSearchParams\s*\}\s+from\s+['"]next\/navigation['"]/,
        'import { useParams } from "next/navigation"'
    );
    
    // Replace hook usage
    content = content.replace(
        /const\s+searchParams\s*=\s*useSearchParams\(\)\r?\n\s*const\s+chatId\s*=\s*searchParams\.get\(['"]chatId['"]\)/,
        'const params = useParams()\n    const chatIdParam = params.chatId as string[] | undefined\n    const chatId = chatIdParam && chatIdParam[0] === \\'chat\\' && chatIdParam[1] ? chatIdParam[1] : undefined'
    );
    
    fs.writeFileSync(filePath, content);
    console.log('Updated ' + file);
});
