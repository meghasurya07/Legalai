"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import {
    Building2, Users, Lock, Plug, CreditCard,
    Shield, Settings as SettingsIcon, Database, FileText, User,
    Bot, HardDrive, CheckCircle2
} from "lucide-react"

interface OrgSettings {
    default_project_visibility?: string;
    allow_external_sharing?: boolean;
    document_encryption_enabled?: boolean;
    audit_logging_enabled?: boolean;
    assistant_context_scope?: string;
    strict_grounding_mode?: boolean;
    ai_memory_persistence?: boolean;
    hallucination_guard_level?: string;
    conflict_detection_enabled?: boolean;
    clause_extraction_enabled?: boolean;
    auto_insights_enabled?: boolean;
    data_retention_days?: number;
    ai_training_opt_out?: boolean;
    storage_region?: string;
    auto_analysis_enabled?: boolean;
    max_file_size_mb?: number;
}

interface UserSettings {
    assistant_language?: string;
    timezone?: string;
}

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState("organization");
    const [activeOrgSection, setActiveOrgSection] = useState("general");

    const [loading, setLoading] = useState(true);

    // States
    const [orgSettings, setOrgSettings] = useState<OrgSettings>({});
    const [userSettings, setUserSettings] = useState<UserSettings>({});

    // Saving states
    const [savingOrg, setSavingOrg] = useState(false);
    const [savingUser, setSavingUser] = useState(false);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const [orgRes, userRes] = await Promise.all([
                    fetch('/api/org/settings'),
                    fetch('/api/user/settings')
                ]);

                const orgData = await orgRes.json();
                const userData = await userRes.json();

                if (orgData.success) {
                    setOrgSettings(orgData.data || {});
                }
                if (userData.success) {
                    setUserSettings(userData.data || {});
                }
            } catch {
                toast.error("Failed to load settings data");
            } finally {
                setLoading(false);
            }
        };

        fetchSettings();
    }, []);

    const handleOrgChange = <K extends keyof OrgSettings>(key: K, value: OrgSettings[K]) => {
        setOrgSettings((prev) => ({ ...prev, [key]: value }));
    };

    const handleUserChange = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
        setUserSettings((prev) => ({ ...prev, [key]: value }));
    };

    const saveOrgSettings = async () => {
        setSavingOrg(true);
        try {
            const res = await fetch('/api/org/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orgSettings)
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Organization settings updated successfully");
            } else {
                toast.error("Failed to update settings");
            }
        } catch {
            toast.error("An error occurred while saving");
        } finally {
            setSavingOrg(false);
        }
    };

    const saveUserSettings = async () => {
        setSavingUser(true);
        try {
            const res = await fetch('/api/user/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userSettings)
            });
            const data = await res.json();
            if (data.success) {
                toast.success("User preferences updated successfully");
            } else {
                toast.error("Failed to update user preferences");
            }
        } catch {
            toast.error("An error occurred while saving");
        } finally {
            setSavingUser(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col flex-1 w-full max-w-[1400px] mx-auto p-4 md:p-6 justify-center items-center h-full">
                <p className="text-muted-foreground">Loading compliance & settings data...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col flex-1 w-full max-w-[1400px] mx-auto p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6 h-full overflow-y-auto">
            {/* Header */}
            <div className="space-y-2">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                        <SettingsIcon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold">Workspace Settings</h1>
                        <p className="text-sm text-muted-foreground">Manage enterprise controls, AI governance, and compliance policies.</p>
                    </div>
                </div>
            </div>

            <Separator />

            {/* Main Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col md:flex-row gap-6">
                <div className="w-full md:w-64 shrink-0">
                    <TabsList className="flex flex-row md:flex-col h-auto bg-transparent justify-start items-stretch gap-2 p-0">
                        <TabsTrigger
                            value="organization"
                            className="justify-start gap-2 data-[state=active]:bg-muted px-4 py-2 h-10 w-full"
                        >
                            <Building2 className="h-4 w-4" />
                            <span>Organization</span>
                        </TabsTrigger>
                        <TabsTrigger
                            value="teams"
                            className="justify-start gap-2 data-[state=active]:bg-muted px-4 py-2 h-10 w-full"
                        >
                            <Users className="h-4 w-4" />
                            <span>Teams</span>
                        </TabsTrigger>
                        <TabsTrigger
                            value="account"
                            className="justify-start gap-2 data-[state=active]:bg-muted px-4 py-2 h-10 w-full"
                        >
                            <User className="h-4 w-4" />
                            <span>Account</span>
                        </TabsTrigger>
                    </TabsList>
                </div>

                <div className="flex-1 w-full min-w-0">
                    {/* ORGANIZATION VIEW */}
                    <TabsContent value="organization" className="mt-0 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            {/* Inner nav for Org settings */}
                            <div className="col-span-1 space-y-1">
                                {[
                                    { id: 'general', icon: SettingsIcon, label: 'General' },
                                    { id: 'security', icon: Lock, label: 'Security & Access' },
                                    { id: 'ai', icon: Bot, label: 'AI Governance' },
                                    { id: 'data', icon: Database, label: 'Data & Compliance' },
                                    { id: 'documents', icon: FileText, label: 'Documents' },
                                    { id: 'integrations', icon: Plug, label: 'Integrations' },
                                    { id: 'billing', icon: CreditCard, label: 'Billing & Usage' }
                                ].map((item) => (
                                    <button
                                        key={item.id}
                                        onClick={() => setActiveOrgSection(item.id)}
                                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors ${activeOrgSection === item.id
                                            ? 'bg-primary text-primary-foreground font-medium'
                                            : 'hover:bg-muted text-muted-foreground'
                                            }`}
                                    >
                                        <item.icon className="h-4 w-4" />
                                        {item.label}
                                    </button>
                                ))}
                            </div>

                            <div className="col-span-1 md:col-span-3 space-y-6">
                                {/* GENERAL */}
                                {activeOrgSection === 'general' && (
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Organization Settings</CardTitle>
                                            <CardDescription>Primary workspace configuration and visibility rules.</CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-6">
                                            <div className="space-y-2">
                                                <Label>Default Project Visibility</Label>
                                                <Select
                                                    value={orgSettings.default_project_visibility || 'organization'}
                                                    onValueChange={(v) => handleOrgChange('default_project_visibility', v)}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="private">Private (Invite Only)</SelectItem>
                                                        <SelectItem value="team">Team (Specific User Groups)</SelectItem>
                                                        <SelectItem value="organization">Organization (All Firm Members)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="flex items-center justify-between">
                                                <div className="space-y-0.5">
                                                    <Label>Allow External Sharing</Label>
                                                    <p className="text-sm text-muted-foreground">Permit sharing secure links with external clients.</p>
                                                </div>
                                                <Switch
                                                    checked={orgSettings.allow_external_sharing || false}
                                                    onCheckedChange={(v) => handleOrgChange('allow_external_sharing', v)}
                                                />
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}

                                {/* SECURITY */}
                                {activeOrgSection === 'security' && (
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" /> Security & Protocol</CardTitle>
                                            <CardDescription>Enterprise security safeguards for internal data access.</CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-6">
                                            <div className="flex items-center justify-between">
                                                <div className="space-y-0.5">
                                                    <Label>Document Encryption</Label>
                                                    <p className="text-sm text-muted-foreground">Ensure at-rest KMS encryption for all uploaded firm documents.</p>
                                                </div>
                                                <Switch
                                                    checked={orgSettings.document_encryption_enabled ?? true}
                                                    onCheckedChange={(v) => handleOrgChange('document_encryption_enabled', v)}
                                                />
                                            </div>
                                            <Separator />
                                            <div className="flex items-center justify-between">
                                                <div className="space-y-0.5">
                                                    <Label>Audit Logging</Label>
                                                    <p className="text-sm text-muted-foreground">Strict ingestion of user actions into the system_logs table.</p>
                                                </div>
                                                <Switch
                                                    checked={orgSettings.audit_logging_enabled ?? true}
                                                    onCheckedChange={(v) => handleOrgChange('audit_logging_enabled', v)}
                                                />
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}

                                {/* AI GOVERNANCE */}
                                {activeOrgSection === 'ai' && (
                                    <div className="space-y-6">
                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="flex items-center gap-2"><Bot className="h-5 w-5" /> Model Governance</CardTitle>
                                                <CardDescription>Control the behavior and limits of the legal assistant.</CardDescription>
                                            </CardHeader>
                                            <CardContent className="space-y-6">
                                                <div className="space-y-2">
                                                    <Label>Assistant Context Scope</Label>
                                                    <p className="text-sm text-muted-foreground pb-2">Defines what documents the AI can cross-reference implicitly.</p>
                                                    <Select
                                                        value={orgSettings.assistant_context_scope || 'project'}
                                                        onValueChange={(v) => handleOrgChange('assistant_context_scope', v)}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="project">Strict Project Boundaries</SelectItem>
                                                            <SelectItem value="organization">Organization Wide Search</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                <Separator />

                                                <div className="flex items-center justify-between">
                                                    <div className="space-y-0.5 pr-4">
                                                        <Label>Strict Grounding Mode</Label>
                                                        <p className="text-sm text-muted-foreground">Force AI to only rely on extracted clauses and ingested document text. Disables web-search features.</p>
                                                    </div>
                                                    <Switch
                                                        checked={orgSettings.strict_grounding_mode ?? true}
                                                        onCheckedChange={(v) => handleOrgChange('strict_grounding_mode', v)}
                                                    />
                                                </div>

                                                <div className="flex items-center justify-between">
                                                    <div className="space-y-0.5">
                                                        <Label>AI Memory Persistence</Label>
                                                        <p className="text-sm text-muted-foreground">Allow background job to synthesize insights.</p>
                                                    </div>
                                                    <Switch
                                                        checked={orgSettings.ai_memory_persistence ?? true}
                                                        onCheckedChange={(v) => handleOrgChange('ai_memory_persistence', v)}
                                                    />
                                                </div>

                                                <div className="space-y-2">
                                                    <Label>Hallucination Guard Level</Label>
                                                    <Select
                                                        value={orgSettings.hallucination_guard_level || 'strict'}
                                                        onValueChange={(v) => handleOrgChange('hallucination_guard_level', v)}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="standard">Standard Checks</SelectItem>
                                                            <SelectItem value="strict">Strict (Highest Verification)</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="text-sm border-b pb-2">Background Intelligence Routines</CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-4 pt-4">
                                                <div className="flex items-center justify-between">
                                                    <Label className="font-normal text-sm">Conflict Detection Enabled</Label>
                                                    <Switch checked={orgSettings.conflict_detection_enabled ?? true} onCheckedChange={(v) => handleOrgChange('conflict_detection_enabled', v)} />
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <Label className="font-normal text-sm">Automated Clause Extraction</Label>
                                                    <Switch checked={orgSettings.clause_extraction_enabled ?? true} onCheckedChange={(v) => handleOrgChange('clause_extraction_enabled', v)} />
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <Label className="font-normal text-sm">Auto Workflow Insights</Label>
                                                    <Switch checked={orgSettings.auto_insights_enabled ?? true} onCheckedChange={(v) => handleOrgChange('auto_insights_enabled', v)} />
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                )}

                                {/* DATA & COMPLIANCE */}
                                {activeOrgSection === 'data' && (
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2"><HardDrive className="h-5 w-5" /> Compliance & Retention</CardTitle>
                                            <CardDescription>Rules to satisfy firm compliance mandates.</CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-6">
                                            <div className="space-y-2">
                                                <Label>Data Retention Policy (Days)</Label>
                                                <Input
                                                    type="number"
                                                    value={orgSettings.data_retention_days || 2555}
                                                    onChange={(e) => handleOrgChange('data_retention_days', parseInt(e.target.value))}
                                                />
                                                <p className="text-xs text-muted-foreground">Files and data are permanently deleted after this timeframe. Default is 7 years (2555 days).</p>
                                            </div>

                                            <Separator />

                                            <div className="flex items-center justify-between bg-muted/50 p-4 rounded-lg border border-border">
                                                <div className="space-y-0.5 flex-1 pr-6">
                                                    <Label className="flex items-center gap-2">
                                                        AI Training Opt-Out
                                                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                                                    </Label>
                                                    <p className="text-sm text-muted-foreground">Your firm&apos;s data is never used to train foundation models. (Enforced securely by enterprise API contracts).</p>
                                                </div>
                                                <Switch
                                                    checked={orgSettings.ai_training_opt_out ?? true}
                                                    disabled
                                                    onCheckedChange={(v) => handleOrgChange('ai_training_opt_out', v)}
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <Label>Storage Region Topology</Label>
                                                <Select
                                                    value={orgSettings.storage_region || 'us-east'}
                                                    onValueChange={(v) => handleOrgChange('storage_region', v)}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="us-east">US East (N. Virginia)</SelectItem>
                                                        <SelectItem value="eu-west">EU (Frankfurt) - GDPR Strict</SelectItem>
                                                        <SelectItem value="ap-southeast">Asia Pacific (Singapore)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}

                                {/* DOCUMENTS */}
                                {activeOrgSection === 'documents' && (
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Documents Ingestion Limits</CardTitle>
                                            <CardDescription>Control bounds for document parsing and OCR.</CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-6">
                                            <div className="flex items-center justify-between">
                                                <div className="space-y-0.5">
                                                    <Label>Automated Document Analysis</Label>
                                                    <p className="text-sm text-muted-foreground">Run OCR and semantic chunking immediately on file upload.</p>
                                                </div>
                                                <Switch
                                                    checked={orgSettings.auto_analysis_enabled ?? true}
                                                    onCheckedChange={(v) => handleOrgChange('auto_analysis_enabled', v)}
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <Label>Max Upload File Size (MB)</Label>
                                                <Input
                                                    type="number"
                                                    value={orgSettings.max_file_size_mb || 50}
                                                    onChange={(e) => handleOrgChange('max_file_size_mb', parseInt(e.target.value))}
                                                />
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}

                                {/* INTEGRATIONS */}
                                {activeOrgSection === 'integrations' && (
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Enterprise Integrations</CardTitle>
                                            <CardDescription>Connect firm directory and SSO providers.</CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-4 text-center py-10">
                                            <Plug className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
                                            <h3 className="font-medium text-lg">Integrations Platform Sync</h3>
                                            <p className="text-sm text-muted-foreground">Setup for iManage, NetDocuments, and Entra ID (SAML/SSO) is managed by your Customer Success team.</p>
                                            <Button variant="outline" className="mt-4">Contact Enterprise Support</Button>
                                        </CardContent>
                                    </Card>
                                )}

                                {/* BILLING */}
                                {activeOrgSection === 'billing' && (
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Billing Profile</CardTitle>
                                            <CardDescription>Plan details and seat assignments.</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="bg-primary/5 p-6 border rounded-lg">
                                                <h3 className="text-lg font-medium text-primary mb-2">Enterprise Plan</h3>
                                                <p className="text-sm text-muted-foreground mb-4">Unlimited Projects • 100 Seats Active • Custom SLA</p>
                                                <div className="flex gap-4">
                                                    <Button variant="default">Manage Seats</Button>
                                                    <Button variant="outline">View Invoices</Button>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}

                                {/* Action Bar for Org Settings */}
                                <div className="flex justify-end pt-4 border-t mt-4">
                                    <Button onClick={saveOrgSettings} disabled={savingOrg}>
                                        {savingOrg ? "Updating Policies..." : "Save Workspace Policies"}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    {/* TEAMS VIEW */}
                    <TabsContent value="teams" className="mt-0">
                        <Card>
                            <CardHeader>
                                <CardTitle>Team Groups</CardTitle>
                                <CardDescription>Manage structured permission overlays mapped to practice areas.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="text-center py-12 bg-muted/20 border border-dashed rounded-lg">
                                    <Users className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                                    <p className="font-medium">No Team Overrides configured.</p>
                                    <p className="text-sm text-muted-foreground mb-4 mt-1">
                                        All users currently inherit the top-level organization policies.
                                    </p>
                                    <Button variant="outline">Create Practice Group</Button>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* ACCOUNT VIEW */}
                    <TabsContent value="account" className="mt-0">
                        <Card>
                            <CardHeader>
                                <CardTitle>User Preferences</CardTitle>
                                <CardDescription>Minimal localization settings. Personalization is restricted in enterprise mode.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label>Assistant Language Preference</Label>
                                        <Select
                                            value={userSettings.assistant_language || 'en'}
                                            onValueChange={(v) => handleUserChange('assistant_language', v)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="en">English (Legal Standard)</SelectItem>
                                                <SelectItem value="fr">French</SelectItem>
                                                <SelectItem value="es">Spanish</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Timezone Mapping</Label>
                                        <Select
                                            value={userSettings.timezone || 'UTC'}
                                            onValueChange={(v) => handleUserChange('timezone', v)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="UTC">Coordinated Universal Time (UTC)</SelectItem>
                                                <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                                                <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                                                <SelectItem value="Europe/London">London (GMT)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="flex justify-end pt-4 border-t mt-4">
                                    <Button onClick={saveUserSettings} disabled={savingUser}>
                                        {savingUser ? "Saving..." : "Save Preferences"}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    )
}
