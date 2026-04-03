/**
 * Splits organization/page.tsx into per-tab component files.
 * Reads the file, finds each "function XxxTab(" boundary, extracts them.
 */
const fs = require('fs');
const path = require('path');

const filePath = 'app/organization/page.tsx';
const src = fs.readFileSync(filePath, 'utf8');
const lines = src.split('\n');

// Find all tab function start lines
const funcStarts = [];
for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^function (\w+Tab)\s*\(/);
    if (match) {
        funcStarts.push({ name: match[1], line: i });
    }
}

console.log('Found tab functions:', funcStarts.map(f => `${f.name} (line ${f.line + 1})`).join(', '));

// Find each function's preceding comment header (// ====)
// and its end (by tracking brace depth)
const outDir = 'app/organization/components';
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

for (const func of funcStarts) {
    // Find the comment header above it
    let headerStart = func.line;
    for (let j = func.line - 1; j >= 0; j--) {
        if (lines[j].match(/^\/\/ =+/)) { headerStart = j; break; }
        if (lines[j].trim() === '') continue;
        break;
    }
    
    // Find the function end by brace counting
    let depth = 0;
    let funcEnd = func.line;
    let started = false;
    for (let j = func.line; j < lines.length; j++) {
        for (const ch of lines[j]) {
            if (ch === '{') { depth++; started = true; }
            if (ch === '}') depth--;
        }
        if (started && depth === 0) { funcEnd = j; break; }
    }
    
    const tabCode = lines.slice(headerStart, funcEnd + 1).join('\n');
    
    // Determine needed imports
    const usedLucide = [];
    const allIcons = ['Building2','Users','Shield','Trash2','Crown','ScrollText','Clock','Mail','Layers','Key','Loader2','ShieldAlert','Plus','X','AlertTriangle','CheckCircle2','Brain','Search','RefreshCw','Filter','ChevronLeft','ChevronRight','Pin','PinOff','Edit3','Save'];
    allIcons.forEach(icon => { if (tabCode.includes(icon)) usedLucide.push(icon); });
    
    const usedCardComps = [];
    ['Card','CardContent','CardDescription','CardHeader','CardTitle'].forEach(c => { if (tabCode.includes(c)) usedCardComps.push(c); });
    
    const needsInput = tabCode.includes('<Input');
    const needsLabel = tabCode.includes('<Label');
    const needsButton = tabCode.includes('<Button');
    const needsSeparator = tabCode.includes('<Separator');
    const needsBadge = tabCode.includes('<Badge') || tabCode.includes('Badge ');
    const needsSelect = tabCode.includes('<Select') || tabCode.includes('SelectTrigger');
    const needsToast = tabCode.includes('toast.');
    const needsTextarea = tabCode.includes('<Textarea');
    const needsSwitch = tabCode.includes('<Switch');
    const needsUseOrg = tabCode.includes('useOrg()');
    const needsPortal = tabCode.includes('createPortal');
    
    // Build file content
    let file = '"use client"\n\n';
    file += 'import { useState, useEffect, useCallback } from "react"\n';
    if (needsPortal) file += 'import { createPortal } from "react-dom"\n';
    if (needsUseOrg) file += 'import { useOrg } from "@/context/org-context"\n';
    if (usedCardComps.length) file += `import { ${usedCardComps.join(', ')} } from "@/components/ui/card"\n`;
    if (needsInput) file += 'import { Input } from "@/components/ui/input"\n';
    if (needsLabel) file += 'import { Label } from "@/components/ui/label"\n';
    if (needsButton) file += 'import { Button } from "@/components/ui/button"\n';
    if (needsSeparator) file += 'import { Separator } from "@/components/ui/separator"\n';
    if (needsBadge) file += 'import { Badge } from "@/components/ui/badge"\n';
    if (needsSelect) file += 'import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"\n';
    if (needsTextarea) file += 'import { Textarea } from "@/components/ui/textarea"\n';
    if (needsSwitch) file += 'import { Switch } from "@/components/ui/switch"\n';
    if (needsToast) file += 'import { toast } from "sonner"\n';
    if (usedLucide.length) file += `import {\n    ${usedLucide.join(',\n    ')},\n} from "lucide-react"\n`;
    
    // Type imports
    const needsTypes = [];
    ['Team','Invite','AuditEntry','OrgMember','OrgData'].forEach(t => { if (tabCode.includes(t)) needsTypes.push(t); });
    if (needsTypes.length) file += `import type { ${needsTypes.join(', ')} } from "../types"\n`;
    
    // Role helpers used
    if (tabCode.includes('roleIcon') || tabCode.includes('roleBadgeVariant')) {
        const helpers = [];
        if (tabCode.includes('roleIcon')) helpers.push('roleIcon');
        if (tabCode.includes('roleBadgeVariant')) helpers.push('roleBadgeVariant');
        file += `import { ${helpers.join(', ')} } from "../helpers"\n`;
    }
    
    file += '\n';
    // Change function to export default
    file += tabCode.replace(`function ${func.name}(`, `export default function ${func.name}(`);
    file += '\n';
    
    const fileName = func.name.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '') + '.tsx';
    fs.writeFileSync(path.join(outDir, fileName), file);
    console.log(`  Created: ${outDir}/${fileName} (${funcEnd - headerStart + 1} lines)`);
}

console.log('\nDone!');
