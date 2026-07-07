import React, { useEffect, useState } from "react";
import {
    Box,
    Typography,
    Card,
    CardContent,
    Button,
    Chip,
    Stack,
    CircularProgress,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    MenuItem,
    FormControlLabel,
    Switch,
    Divider,
    Paper,
    Alert,
    IconButton,
    Accordion,
    AccordionSummary,
    AccordionDetails,
} from "@mui/material";
import {
    Add as AddIcon,
    PlayArrow as PlayIcon,
    CheckCircle as ApproveIcon,
    Cancel as RejectIcon,
    ExpandMore as ExpandMoreIcon,
    SmartToy as SmartToyIcon,
    Refresh as RefreshIcon,
} from "@mui/icons-material";

interface AgentStep {
    id: string;
    action: string;
    args: Record<string, unknown>;
    dependsOn?: string[];
    status: "pending" | "running" | "completed" | "failed" | "skipped";
    result?: unknown;
    error?: string;
    startedAt?: string;
    completedAt?: string;
}

interface AgentTask {
    id: string;
    type: "localization" | "compliance" | "brand-voice" | "seo-audit" | "rot-cleanup" | "custom";
    status: "pending" | "planning" | "executing" | "review" | "completed" | "failed" | "cancelled";
    goal: string;
    plan?: AgentStep[];
    results?: Array<{ stepId: string; action: string; success: boolean; output?: unknown; error?: string }>;
    requiresHumanReview: boolean;
    createdBy: string;
    tenantId: string;
    startedAt?: string;
    completedAt?: string;
    error?: string;
    createdAt?: string;
}

const taskTypeLabels: Record<string, string> = {
    localization: "Auto-Localization",
    compliance: "Compliance Scanner",
    "brand-voice": "Brand Voice Auditor",
    "seo-audit": "SEO Optimizer",
    "rot-cleanup": "ROT Cleanup",
    custom: "Custom Workflow",
};

const taskTypeColors: Record<string, "primary" | "secondary" | "success" | "warning" | "info" | "error" | "default"> = {
    localization: "primary",
    compliance: "warning",
    "brand-voice": "info",
    "seo-audit": "success",
    "rot-cleanup": "error",
    custom: "default",
};

const statusColors: Record<string, "primary" | "secondary" | "success" | "warning" | "info" | "error" | "default"> = {
    pending: "default",
    planning: "info",
    executing: "primary",
    review: "warning",
    completed: "success",
    failed: "error",
    cancelled: "default",
};

export function AgentsPage() {
    const [tasks, setTasks] = useState<AgentTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [openDialog, setOpenDialog] = useState(false);
    const [taskType, setTaskType] = useState("localization");
    const [goal, setGoal] = useState("");
    const [requiresReview, setRequiresReview] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const fetchTasks = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/agents/tasks");
            if (res.ok) {
                const data = await res.json();
                setTasks(Array.isArray(data) ? data : []);
            }
        } catch (err) {
            console.error("Failed to fetch agent tasks:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTasks();
    }, []);

    const handleCreateTask = async () => {
        if (!goal.trim()) return;
        setSubmitting(true);
        setErrorMsg(null);
        try {
            const res = await fetch("/api/agents/tasks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: taskType,
                    goal,
                    requiresHumanReview: requiresReview,
                }),
            });
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error?.message || "Failed to create task");
            }
            setOpenDialog(false);
            setGoal("");
            fetchTasks();
        } catch (err) {
            setErrorMsg(err instanceof Error ? err.message : String(err));
        } finally {
            setSubmitting(false);
        }
    };

    const handleExecute = async (id: string) => {
        try {
            await fetch(`/api/agents/tasks/${id}/execute`, { method: "POST" });
            fetchTasks();
        } catch (err) {
            console.error("Execute error:", err);
        }
    };

    const handleReview = async (id: string, approved: boolean, note?: string) => {
        try {
            await fetch(`/api/agents/tasks/${id}/review`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ approved, note }),
            });
            fetchTasks();
        } catch (err) {
            console.error("Review error:", err);
        }
    };

    const handleCancel = async (id: string) => {
        try {
            await fetch(`/api/agents/tasks/${id}/cancel`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reason: "Cancelled from admin UI" }),
            });
            fetchTasks();
        } catch (err) {
            console.error("Cancel error:", err);
        }
    };

    return (
        <Box sx={{ p: 4, maxWidth: 1200, mx: "auto" }}>
            <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 4 }}>
                <Box>
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 1 }}>
                        <SmartToyIcon sx={{ fontSize: 36, color: "primary.main" }} />
                        <Typography variant="h4" sx={{ fontWeight: "bold" }}>
                            Autonomous Agent Framework
                        </Typography>
                    </Stack>
                    <Typography variant="body1" color="textSecondary">
                        Orchestrate AI agents to autonomously execute multi-step localization, compliance, and SEO operations with human-in-the-loop governance.
                    </Typography>
                </Box>
                <Stack direction="row" spacing={2}>
                    <IconButton onClick={fetchTasks} title="Refresh tasks">
                        <RefreshIcon />
                    </IconButton>
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => setOpenDialog(true)}
                        sx={{ px: 3, py: 1, borderRadius: 2 }}
                    >
                        New Agent Task
                    </Button>
                </Stack>
            </Stack>

            {loading ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
                    <CircularProgress />
                </Box>
            ) : tasks.length === 0 ? (
                <Paper sx={{ p: 6, textAlign: "center", borderRadius: 3, bgcolor: "background.paper" }}>
                    <SmartToyIcon sx={{ fontSize: 64, color: "text.disabled", mb: 2 }} />
                    <Typography variant="h6" gutterBottom>
                        No Autonomous Agent Tasks Found
                    </Typography>
                    <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
                        Create your first agent task to automate repetitive enterprise workflows like localization or ROT cleanup.
                    </Typography>
                    <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setOpenDialog(true)}>
                        Create Task
                    </Button>
                </Paper>
            ) : (
                <Stack spacing={3}>
                    {tasks.map((task) => (
                        <Card key={task.id} sx={{ borderRadius: 3, boxShadow: 2, overflow: "hidden" }}>
                            <CardContent sx={{ p: 3 }}>
                                <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start", mb: 2 }}>
                                    <Box>
                                        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 1 }}>
                                            <Chip
                                                label={taskTypeLabels[task.type] || task.type}
                                                color={taskTypeColors[task.type] || "default"}
                                                size="small"
                                                sx={{ fontWeight: "bold" }}
                                            />
                                            <Chip
                                                label={task.status.toUpperCase()}
                                                color={statusColors[task.status] || "default"}
                                                size="small"
                                                variant="outlined"
                                            />
                                            <Typography variant="caption" color="textSecondary">
                                                ID: {task.id}
                                            </Typography>
                                        </Stack>
                                        <Typography variant="h6" sx={{ fontWeight: "600", mt: 0.5 }}>
                                            {task.goal}
                                        </Typography>
                                    </Box>

                                    <Stack direction="row" spacing={1}>
                                        {task.status === "pending" && (
                                            <Button
                                                size="small"
                                                variant="contained"
                                                color="primary"
                                                startIcon={<PlayIcon />}
                                                onClick={() => handleExecute(task.id)}
                                            >
                                                Run Now
                                            </Button>
                                        )}
                                        {task.status === "review" && (
                                            <Stack direction="row" spacing={1}>
                                                <Button
                                                    size="small"
                                                    variant="contained"
                                                    color="success"
                                                    startIcon={<ApproveIcon />}
                                                    onClick={() => handleReview(task.id, true, "Approved from Admin UI")}
                                                >
                                                    Approve Gate
                                                </Button>
                                                <Button
                                                    size="small"
                                                    variant="outlined"
                                                    color="error"
                                                    startIcon={<RejectIcon />}
                                                    onClick={() => handleReview(task.id, false, "Rejected from Admin UI")}
                                                >
                                                    Reject
                                                </Button>
                                            </Stack>
                                        )}
                                        {task.status !== "completed" && task.status !== "cancelled" && (
                                            <Button size="small" color="inherit" onClick={() => handleCancel(task.id)}>
                                                Cancel
                                            </Button>
                                        )}
                                    </Stack>
                                </Stack>

                                {task.error && (
                                    <Alert severity="error" sx={{ mb: 2 }}>
                                        {task.error}
                                    </Alert>
                                )}

                                <Divider sx={{ my: 2 }} />

                                <Typography variant="subtitle2" color="textSecondary" sx={{ mb: 1 }}>
                                    Execution Plan & Step Timeline ({task.plan?.length || 0} Steps)
                                </Typography>

                                {task.plan && task.plan.length > 0 ? (
                                    <Stack spacing={1}>
                                        {task.plan.map((step, idx) => (
                                            <Accordion key={step.id || idx} disableGutters elevation={0} sx={{ bgcolor: "background.default", borderRadius: 1 }}>
                                                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                                    <Stack direction="row" spacing={2} sx={{ alignItems: "center", width: "100%" }}>
                                                        <Typography variant="body2" sx={{ fontWeight: "bold", minWidth: 24 }}>
                                                            #{idx + 1}
                                                        </Typography>
                                                        <Chip
                                                            label={step.action}
                                                            size="small"
                                                            color="primary"
                                                            variant="outlined"
                                                            sx={{ fontFamily: "monospace" }}
                                                        />
                                                        <Chip
                                                            label={step.status}
                                                            size="small"
                                                            color={statusColors[step.status] || "default"}
                                                        />
                                                        {step.error && (
                                                            <Typography variant="caption" color="error" sx={{ ml: "auto" }}>
                                                                {step.error}
                                                            </Typography>
                                                        )}
                                                    </Stack>
                                                </AccordionSummary>
                                                <AccordionDetails sx={{ pt: 0, borderTop: "1px solid rgba(0,0,0,0.05)" }}>
                                                    <Box sx={{ mt: 1 }}>
                                                        <Typography variant="caption" color="textSecondary" sx={{ display: "block" }}>
                                                            Arguments:
                                                        </Typography>
                                                        <Paper
                                                            component="pre"
                                                            sx={{
                                                                p: 1.5,
                                                                bgcolor: "background.paper",
                                                                fontSize: "0.75rem",
                                                                overflowX: "auto",
                                                                borderRadius: 1,
                                                                my: 0.5,
                                                            }}
                                                        >
                                                            {JSON.stringify(step.args, null, 2)}
                                                        </Paper>

                                                        {Boolean(step.result) && (
                                                            <>
                                                                <Typography variant="caption" color="textSecondary" sx={{ display: "block", mt: 1 }}>
                                                                    Output:
                                                                </Typography>
                                                                <Paper
                                                                    component="pre"
                                                                    sx={{
                                                                        p: 1.5,
                                                                        bgcolor: "background.paper",
                                                                        fontSize: "0.75rem",
                                                                        overflowX: "auto",
                                                                        borderRadius: 1,
                                                                        my: 0.5,
                                                                    }}
                                                                >
                                                                    {JSON.stringify(step.result, null, 2)}
                                                                </Paper>
                                                            </>
                                                        )}
                                                    </Box>
                                                </AccordionDetails>
                                            </Accordion>
                                        ))}
                                    </Stack>
                                ) : (
                                    <Typography variant="body2" color="textSecondary">
                                        No steps planned yet.
                                    </Typography>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </Stack>
            )}

            <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ fontWeight: "bold" }}>Create Autonomous Agent Task</DialogTitle>
                <DialogContent dividers>
                    {errorMsg && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {errorMsg}
                        </Alert>
                    )}
                    <Stack spacing={3} sx={{ pt: 1 }}>
                        <TextField
                            select
                            label="Agent Type"
                            value={taskType}
                            onChange={(e) => setTaskType(e.target.value)}
                            fullWidth
                        >
                            <MenuItem value="localization">Auto-Localization Agent</MenuItem>
                            <MenuItem value="compliance">Compliance & ROT Scanner</MenuItem>
                            <MenuItem value="brand-voice">Brand Voice Auditor</MenuItem>
                            <MenuItem value="seo-audit">SEO Optimizer Agent</MenuItem>
                            <MenuItem value="custom">Custom MCP Workflow</MenuItem>
                        </TextField>

                        <TextField
                            label="Natural Language Goal"
                            placeholder="e.g., Translate all untranslated marketing pages to Spanish and French"
                            multiline
                            rows={3}
                            value={goal}
                            onChange={(e) => setGoal(e.target.value)}
                            fullWidth
                            helperText="Describe what the agent should accomplish. The AI planner will generate a multi-step MCP workflow."
                        />

                        <FormControlLabel
                            control={
                                <Switch
                                    checked={requiresReview}
                                    onChange={(e) => setRequiresReview(e.target.checked)}
                                    color="primary"
                                />
                            }
                            label={
                                <Box>
                                    <Typography variant="body2" sx={{ fontWeight: "600" }}>
                                        Require Human-in-the-Loop Review
                                    </Typography>
                                    <Typography variant="caption" color="textSecondary">
                                        Pause execution after planning to allow governance gate approval before modifying content.
                                    </Typography>
                                </Box>
                            }
                        />
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ p: 2.5 }}>
                    <Button onClick={() => setOpenDialog(false)} color="inherit">
                        Cancel
                    </Button>
                    <Button
                        onClick={handleCreateTask}
                        variant="contained"
                        disabled={submitting || !goal.trim()}
                        startIcon={submitting ? <CircularProgress size={16} /> : <SmartToyIcon />}
                    >
                        {submitting ? "Planning..." : "Create & Plan Task"}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
