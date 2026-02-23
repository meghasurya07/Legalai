import { supabase } from '@/lib/supabase/server'

// Resolution logic:
// 1. Fetch User Settings -> gets default_org_id
// 2. Fetch Org Settings for that org
// 3. Fetch Team Settings for a specific team (if applicable)
// 4. Merge them (User -> Team -> Org overrides where appropriate)

export async function getEffectiveSettings(userId: string, orgId?: string, teamId?: string) {
    // Basic user settings
    let finalOrgId = orgId;
    let userSettings = null;

    const { data: userData } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (userData) {
        userSettings = userData;
        if (!finalOrgId && userData.default_org_id) {
            finalOrgId = userData.default_org_id;
        }
    }

    // Default to the seeded org if none found for MVP
    if (!finalOrgId) {
        finalOrgId = '00000000-0000-0000-0000-000000000001';
    }

    let orgSettings = null;
    if (finalOrgId) {
        const { data: orgData } = await supabase
            .from('organization_settings')
            .select('*')
            .eq('organization_id', finalOrgId)
            .single();
        orgSettings = orgData;
    }

    let teamSettings = null;
    if (teamId) {
        const { data: teamData } = await supabase
            .from('team_settings')
            .select('*')
            .eq('team_id', teamId)
            .single();
        teamSettings = teamData;
    }

    // Default enterprise safe settings if no db row yet
    const defaults = {
        default_project_visibility: 'organization',
        allow_external_sharing: false,
        data_retention_days: 2555,
        document_encryption_enabled: true,
        audit_logging_enabled: true,
        ai_training_opt_out: true,
        storage_region: 'us-east',
        assistant_context_scope: 'project',
        workflow_execution_limits: 100,
        auto_insights_enabled: true,
        conflict_detection_enabled: true,
        clause_extraction_enabled: true,
        strict_grounding_mode: true,
        hallucination_guard_level: 'strict',
        ai_memory_persistence: true,
        workflows_all_docs_access: false,
        allowed_file_types: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
        max_file_size_mb: 50,
        ocr_enabled: true,
        auto_analysis_enabled: true
    };

    const effectiveSettings = { ...defaults, ...(orgSettings || {}) };

    // Apply team overrides if they exist
    if (teamSettings) {
        if (teamSettings.project_visibility_override) effectiveSettings.default_project_visibility = teamSettings.project_visibility_override;
        if (teamSettings.external_sharing_override !== null) effectiveSettings.allow_external_sharing = teamSettings.external_sharing_override;
        if (teamSettings.ai_scope_override) effectiveSettings.assistant_context_scope = teamSettings.ai_scope_override;
    }

    return {
        effectiveSettings,
        userSettings,
        orgSettings,
        teamSettings,
        resolvedOrgId: finalOrgId
    };
}
