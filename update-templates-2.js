const fs = require('fs');
const path = require('path');

const dir = 'c:/product/components';
const templateComponents = [
    'client-alert.tsx', 'company-profile.tsx', 'contract-analysis.tsx',
    'document-comparison.tsx', 'draft-from-template.tsx', 'legal-memo.tsx',
    'redline-analysis.tsx', 'transcripts.tsx', 'translation.tsx'
];

let successCount = 0;
templateComponents.forEach(file => {
    const filePath = path.join(dir, file);
    if (!fs.existsSync(filePath)) {
        console.log('Skipping ' + file + ' - missing');
        return;
    }
    
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace import
    let newContent = content.replace('import { useSearchParams } from "next/navigation"', 'import { useParams } from "next/navigation"');
    
    // Replace hook usage
    const oldHookUsage = const searchParams = useSearchParams()
    const chatId = searchParams.get('chatId');
    const oldHookUsageWin = const searchParams = useSearchParams()\r\n    const chatId = searchParams.get('chatId');
    
    const newHookUsage = const params = useParams()
    const chatIdParam = params.chatId as string[] | undefined
    const chatId = chatIdParam && chatIdParam[0] === 'chat' && chatIdParam[1] ? chatIdParam[1] : undefined;
    
    if (newContent.includes(oldHookUsage)) {
        newContent = newContent.replace(oldHookUsage, newHookUsage);
    } else if (newContent.includes(oldHookUsageWin)) {
        newContent = newContent.replace(oldHookUsageWin, newHookUsage);
    } else {
        // Fallback robust replace:
        newContent = newContent.replace(/const\s+searchParams\s*=\s*useSearchParams\(\)[\s\S]*?const\s+chatId\s*=\s*searchParams\.get\([^)]+\)/, newHookUsage);
    }
    
    if (content !== newContent) {
        fs.writeFileSync(filePath, newContent);
        console.log('Successfully updated ' + file);
        successCount++;
    } else {
        console.log('No changes needed or missed for ' + file);
    }
});
console.log('Total updated: ' + successCount);
