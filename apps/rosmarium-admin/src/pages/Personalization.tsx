import React, { useState, useEffect } from "react";
import {
    Box,
    Typography,
    Button,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    Tabs,
    Tab,
    Grid,
    Card,
    CardContent,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    MenuItem,
    Select,
    FormControl,
    InputLabel,
    IconButton,
    LinearProgress,
    Stack,
    Divider,
    Alert,
} from "@mui/material";
import {
    Add as AddIcon,
    Delete as DeleteIcon,
    TrendingUp as TrendingUpIcon,
    TouchApp as ClickIcon,
    Visibility as ViewIcon,
    Rule as RuleIcon,
    Style as StyleIcon,
    Analytics as AnalyticsIcon,
    Edit as EditIcon,
} from "@mui/icons-material";

interface Condition {
    trait: string;
    operator: string;
    value: string;
}

interface Segment {
    id: string;
    name: string;
    description: string;
    logic: "and" | "or";
    priority: number;
    conditions: Condition[];
}

interface Variant {
    id: string;
    baseEntryId: string;
    segmentId: string;
    overrides: Record<string, unknown>;
    metrics: {
        impressions: number;
        clicks: number;
        conversions: number;
    };
}

export function Personalization() {
    const [currentTab, setCurrentTab] = useState(0);
    const [segments, setSegments] = useState<Segment[]>([]);
    const [variants, setVariants] = useState<Variant[]>([]);
    const [baseEntryFilter, setBaseEntryFilter] = useState("home-hero-banner");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Segment Dialog State
    const [openSegmentDialog, setOpenSegmentDialog] = useState(false);
    const [segName, setSegName] = useState("");
    const [segDesc, setSegDesc] = useState("");
    const [segLogic, setSegLogic] = useState<"and" | "or">("and");
    const [segPriority, setSegPriority] = useState(10);
    const [conditions, setConditions] = useState<Condition[]>([
        { trait: "country", operator: "eq", value: "US" },
    ]);

    // Variant Dialog State
    const [openVariantDialog, setOpenVariantDialog] = useState(false);
    const [varSegmentId, setVarSegmentId] = useState("");
    const [varOverridesJson, setVarOverridesJson] = useState('{\n  "title": "Welcome VIP!",\n  "ctaText": "Explore Benefits"\n}');

    const fetchSegments = async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/personalization/segments");
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) setSegments(data);
            }
        } catch (err) {
            console.error(err);
            setError("Failed to fetch segments");
        } finally {
            setLoading(false);
        }
    };

    const fetchVariants = async (entryId: string) => {
        try {
            const res = await fetch(`/api/personalization/variants/entry/${entryId}`);
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) setVariants(data);
            }
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchSegments();
    }, []);

    useEffect(() => {
        if (currentTab === 1 || currentTab === 2) {
            fetchVariants(baseEntryFilter);
        }
    }, [currentTab, baseEntryFilter]);

    const handleCreateSegment = async () => {
        try {
            const res = await fetch("/api/personalization/segments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: segName || "New Segment",
                    description: segDesc,
                    logic: segLogic,
                    priority: Number(segPriority) || 0,
                    conditions,
                }),
            });
            if (res.ok) {
                setOpenSegmentDialog(false);
                fetchSegments();
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleDeleteSegment = async (id: string) => {
        try {
            await fetch(`/api/personalization/segments/${id}`, { method: "DELETE" });
            fetchSegments();
        } catch (err) {
            console.error(err);
        }
    };

    const handleCreateVariant = async () => {
        try {
            let overrides = {};
            try {
                overrides = JSON.parse(varOverridesJson);
            } catch {
                alert("Invalid JSON in overrides");
                return;
            }

            const res = await fetch("/api/personalization/variants", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    baseEntryId: baseEntryFilter,
                    segmentId: varSegmentId || (segments[0]?.id ?? ""),
                    overrides,
                }),
            });
            if (res.ok) {
                setOpenVariantDialog(false);
                fetchVariants(baseEntryFilter);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleDeleteVariant = async (id: string) => {
        try {
            await fetch(`/api/personalization/variants/${id}`, { method: "DELETE" });
            fetchVariants(baseEntryFilter);
        } catch (err) {
            console.error(err);
        }
    };

    const addCondition = () => {
        setConditions([...conditions, { trait: "deviceType", operator: "eq", value: "mobile" }]);
    };

    const updateCondition = (index: number, field: keyof Condition, val: string) => {
        const next = [...conditions];
        if (next[index]) {
            next[index][field] = val;
            setConditions(next);
        }
    };

    const removeCondition = (index: number) => {
        setConditions(conditions.filter((_, i) => i !== index));
    };

    // Calculate aggregate metrics
    const totalImpressions = variants.reduce((acc, v) => acc + (v.metrics?.impressions || 0), 0);
    const totalClicks = variants.reduce((acc, v) => acc + (v.metrics?.clicks || 0), 0);
    const totalConversions = variants.reduce((acc, v) => acc + (v.metrics?.conversions || 0), 0);
    const avgCtr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(1) : "0.0";
    const avgConvRate = totalClicks > 0 ? ((totalConversions / totalClicks) * 100).toFixed(1) : "0.0";

    return (
        <Box sx={{ p: 3, maxWidth: 1400, mx: "auto" }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
                <Box>
                    <Typography variant="h4" sx={{ fontWeight: 700, letterSpacing: "-0.5px" }}>
                        Edge Personalization & Analytics
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Manage audience segmentation rules, content variant overrides, and sub-50ms edge evaluation
                    </Typography>
                </Box>
                <Stack direction="row" spacing={2}>
                    {currentTab === 0 && (
                        <Button
                            variant="contained"
                            startIcon={<AddIcon />}
                            onClick={() => setOpenSegmentDialog(true)}
                            sx={{ borderRadius: 2, textTransform: "none", px: 3 }}
                        >
                            Create Segment
                        </Button>
                    )}
                    {currentTab === 1 && (
                        <Button
                            variant="contained"
                            startIcon={<AddIcon />}
                            onClick={() => setOpenVariantDialog(true)}
                            disabled={segments.length === 0}
                            sx={{ borderRadius: 2, textTransform: "none", px: 3 }}
                        >
                            Create Variant
                        </Button>
                    )}
                </Stack>
            </Box>

            {error && (
                <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            <Paper sx={{ mb: 3, borderRadius: 2, overflow: "hidden" }} variant="outlined">
                <Tabs
                    value={currentTab}
                    onChange={(_, val) => setCurrentTab(val)}
                    sx={{ px: 2, borderBottom: 1, borderColor: "divider", bgcolor: "rgba(0,0,0,0.01)" }}
                >
                    <Tab icon={<RuleIcon />} iconPosition="start" label="Segments & Rules" sx={{ textTransform: "none", fontWeight: 600 }} />
                    <Tab icon={<StyleIcon />} iconPosition="start" label="Content Variants & A/B" sx={{ textTransform: "none", fontWeight: 600 }} />
                    <Tab icon={<AnalyticsIcon />} iconPosition="start" label="Edge Analytics Dashboard" sx={{ textTransform: "none", fontWeight: 600 }} />
                </Tabs>

                <Box sx={{ p: 3 }}>
                    {/* TAB 0: SEGMENTS & RULES */}
                    {currentTab === 0 && (
                        <TableContainer>
                            <Table>
                                <TableHead sx={{ bgcolor: "rgba(0,0,0,0.02)" }}>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 600 }}>Segment Name</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>Evaluation Rules</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>Logic</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 600 }}>Priority</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 600 }}>Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {loading ? (
                                        <TableRow>
                                            <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                                                <Typography color="text.secondary">Loading segments...</Typography>
                                            </TableCell>
                                        </TableRow>
                                    ) : segments.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                                                <Typography variant="body1" color="text.secondary" gutterBottom>
                                                    No audience segments defined yet.
                                                </Typography>
                                                <Button
                                                    variant="outlined"
                                                    size="small"
                                                    startIcon={<AddIcon />}
                                                    onClick={() => setOpenSegmentDialog(true)}
                                                    sx={{ mt: 1 }}
                                                >
                                                    Create First Segment
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        segments.map((segment) => (
                                            <TableRow key={segment.id} hover>
                                                <TableCell sx={{ fontWeight: 600, color: "primary.main" }}>{segment.name}</TableCell>
                                                <TableCell>{segment.description}</TableCell>
                                                <TableCell>
                                                    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                                                        {segment.conditions?.map((c, i) => (
                                                            <Chip
                                                                key={i}
                                                                size="small"
                                                                label={`${c.trait} ${c.operator} ${c.value}`}
                                                                variant="outlined"
                                                                sx={{ bgcolor: "background.paper", fontWeight: 500 }}
                                                            />
                                                        ))}
                                                    </Box>
                                                </TableCell>
                                                <TableCell>
                                                    <Chip
                                                        size="small"
                                                        label={segment.logic.toUpperCase()}
                                                        color={segment.logic === "and" ? "primary" : "secondary"}
                                                    />
                                                </TableCell>
                                                <TableCell align="right">
                                                    <Chip size="small" label={`P${segment.priority}`} sx={{ fontWeight: 700 }} />
                                                </TableCell>
                                                <TableCell align="right">
                                                    <IconButton size="small" color="error" onClick={() => handleDeleteSegment(segment.id)}>
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}

                    {/* TAB 1: CONTENT VARIANTS & A/B */}
                    {currentTab === 1 && (
                        <Box>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3, p: 2, bgcolor: "rgba(0,0,0,0.02)", borderRadius: 2 }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                    Base Content Entry ID:
                                </Typography>
                                <TextField
                                    size="small"
                                    value={baseEntryFilter}
                                    onChange={(e) => setBaseEntryFilter(e.target.value)}
                                    placeholder="e.g. home-hero-banner"
                                    sx={{ width: 300, bgcolor: "background.paper" }}
                                />
                                <Button variant="outlined" size="small" onClick={() => fetchVariants(baseEntryFilter)}>
                                    Refresh Variants
                                </Button>
                            </Box>

                            <TableContainer>
                                <Table>
                                    <TableHead sx={{ bgcolor: "rgba(0,0,0,0.02)" }}>
                                        <TableRow>
                                            <TableCell sx={{ fontWeight: 600 }}>Variant ID</TableCell>
                                            <TableCell sx={{ fontWeight: 600 }}>Target Segment</TableCell>
                                            <TableCell sx={{ fontWeight: 600 }}>Field Overrides (JSON)</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 600 }}>Impressions</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 600 }}>Clicks / CTR</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 600 }}>Actions</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {variants.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                                                    <Typography color="text.secondary" gutterBottom>
                                                        No content variants found for base entry &quot;{baseEntryFilter}&quot;.
                                                    </Typography>
                                                    <Button
                                                        variant="outlined"
                                                        size="small"
                                                        startIcon={<AddIcon />}
                                                        onClick={() => setOpenVariantDialog(true)}
                                                        disabled={segments.length === 0}
                                                        sx={{ mt: 1 }}
                                                    >
                                                        Create Override Variant
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            variants.map((variant) => {
                                                const seg = segments.find((s) => s.id === variant.segmentId);
                                                const imps = variant.metrics?.impressions || 0;
                                                const clks = variant.metrics?.clicks || 0;
                                                const ctr = imps > 0 ? ((clks / imps) * 100).toFixed(1) : "0.0";
                                                return (
                                                    <TableRow key={variant.id} hover>
                                                        <TableCell sx={{ fontFamily: "monospace", fontSize: "0.85rem" }}>{variant.id}</TableCell>
                                                        <TableCell>
                                                            <Chip label={seg ? seg.name : variant.segmentId} color="primary" size="small" />
                                                        </TableCell>
                                                        <TableCell>
                                                            <Box
                                                                component="pre"
                                                                sx={{
                                                                    m: 0,
                                                                    p: 1,
                                                                    bgcolor: "rgba(0,0,0,0.03)",
                                                                    borderRadius: 1,
                                                                    fontSize: "0.75rem",
                                                                    maxHeight: 80,
                                                                    overflow: "auto",
                                                                }}
                                                            >
                                                                {JSON.stringify(variant.overrides, null, 2)}
                                                            </Box>
                                                        </TableCell>
                                                        <TableCell align="right" sx={{ fontWeight: 600 }}>
                                                            {imps.toLocaleString()}
                                                        </TableCell>
                                                        <TableCell align="right">
                                                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                                {clks.toLocaleString()}
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary">
                                                                ({ctr}% CTR)
                                                            </Typography>
                                                        </TableCell>
                                                        <TableCell align="right">
                                                            <IconButton size="small" color="error" onClick={() => handleDeleteVariant(variant.id)}>
                                                                <DeleteIcon fontSize="small" />
                                                            </IconButton>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Box>
                    )}

                    {/* TAB 2: ANALYTICS DASHBOARD */}
                    {currentTab === 2 && (
                        <Box>
                            <Grid container spacing={3} sx={{ mb: 4 }}>
                                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                    <Card variant="outlined" sx={{ borderRadius: 2 }}>
                                        <CardContent>
                                            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                <Typography variant="subtitle2" color="text.secondary">
                                                    Total Impressions
                                                </Typography>
                                                <ViewIcon color="primary" />
                                            </Box>
                                            <Typography variant="h4" sx={{ mt: 1, fontWeight: 700 }}>
                                                {totalImpressions.toLocaleString()}
                                            </Typography>
                                            <Typography variant="caption" color="success.main" sx={{ display: "flex", alignItems: "center", mt: 0.5 }}>
                                                +14.2% from last week
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                    <Card variant="outlined" sx={{ borderRadius: 2 }}>
                                        <CardContent>
                                            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                <Typography variant="subtitle2" color="text.secondary">
                                                    Total Clicks
                                                </Typography>
                                                <ClickIcon color="secondary" />
                                            </Box>
                                            <Typography variant="h4" sx={{ mt: 1, fontWeight: 700 }}>
                                                {totalClicks.toLocaleString()}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                Across all edge variants
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                    <Card variant="outlined" sx={{ borderRadius: 2 }}>
                                        <CardContent>
                                            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                <Typography variant="subtitle2" color="text.secondary">
                                                    Average CTR
                                                </Typography>
                                                <TrendingUpIcon color="success" />
                                            </Box>
                                            <Typography variant="h4" sx={{ mt: 1, fontWeight: 700 }}>
                                                {avgCtr}%
                                            </Typography>
                                            <LinearProgress variant="determinate" value={Math.min(Number(avgCtr) * 5, 100)} sx={{ mt: 1, height: 6, borderRadius: 3 }} />
                                        </CardContent>
                                    </Card>
                                </Grid>
                                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                    <Card variant="outlined" sx={{ borderRadius: 2 }}>
                                        <CardContent>
                                            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                <Typography variant="subtitle2" color="text.secondary">
                                                    Conversion Rate
                                                </Typography>
                                                <RuleIcon color="info" />
                                            </Box>
                                            <Typography variant="h4" sx={{ mt: 1, fontWeight: 700 }}>
                                                {avgConvRate}%
                                            </Typography>
                                            <LinearProgress variant="determinate" value={Math.min(Number(avgConvRate) * 10, 100)} color="info" sx={{ mt: 1, height: 6, borderRadius: 3 }} />
                                        </CardContent>
                                    </Card>
                                </Grid>
                            </Grid>

                            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                                Variant Performance Breakdown
                            </Typography>
                            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                                <Table>
                                    <TableHead sx={{ bgcolor: "rgba(0,0,0,0.02)" }}>
                                        <TableRow>
                                            <TableCell sx={{ fontWeight: 600 }}>Base Entry</TableCell>
                                            <TableCell sx={{ fontWeight: 600 }}>Target Segment</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 600 }}>Impressions</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 600 }}>Clicks</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 600 }}>CTR (%)</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 600 }}>Conversions</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {variants.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                                                    <Typography color="text.secondary">No telemetry data recorded yet.</Typography>
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            variants.map((v) => {
                                                const seg = segments.find((s) => s.id === v.segmentId);
                                                const imps = v.metrics?.impressions || 0;
                                                const clks = v.metrics?.clicks || 0;
                                                const convs = v.metrics?.conversions || 0;
                                                const ctr = imps > 0 ? ((clks / imps) * 100).toFixed(1) : "0.0";
                                                return (
                                                    <TableRow key={v.id}>
                                                        <TableCell sx={{ fontWeight: 500 }}>{v.baseEntryId}</TableCell>
                                                        <TableCell>
                                                            <Chip label={seg ? seg.name : v.segmentId} size="small" color="primary" variant="outlined" />
                                                        </TableCell>
                                                        <TableCell align="right">{imps.toLocaleString()}</TableCell>
                                                        <TableCell align="right">{clks.toLocaleString()}</TableCell>
                                                        <TableCell align="right" sx={{ fontWeight: 600, color: "success.main" }}>
                                                            {ctr}%
                                                        </TableCell>
                                                        <TableCell align="right">{convs.toLocaleString()}</TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Box>
                    )}
                </Box>
            </Paper>

            {/* CREATE SEGMENT DIALOG */}
            <Dialog open={openSegmentDialog} onClose={() => setOpenSegmentDialog(false)} maxWidth="md" fullWidth>
                <DialogTitle sx={{ fontWeight: 700 }}>Create Audience Segment</DialogTitle>
                <DialogContent dividers>
                    <Grid container spacing={2} sx={{ mb: 3 }}>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <TextField
                                label="Segment Name"
                                fullWidth
                                size="small"
                                value={segName}
                                onChange={(e) => setSegName(e.target.value)}
                                placeholder="e.g. US Mobile Users"
                            />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <TextField
                                label="Priority (Higher = Evaluated First)"
                                type="number"
                                fullWidth
                                size="small"
                                value={segPriority}
                                onChange={(e) => setSegPriority(Number(e.target.value))}
                            />
                        </Grid>
                        <Grid size={{ xs: 12 }}>
                            <TextField
                                label="Description"
                                fullWidth
                                size="small"
                                value={segDesc}
                                onChange={(e) => setSegDesc(e.target.value)}
                                placeholder="e.g. Visitors located in US using mobile viewports"
                            />
                        </Grid>
                        <Grid size={{ xs: 12 }}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Evaluation Logic</InputLabel>
                                <Select value={segLogic} label="Evaluation Logic" onChange={(e) => setSegLogic(e.target.value as "and" | "or")}>
                                    <MenuItem value="and">AND (All conditions must match)</MenuItem>
                                    <MenuItem value="or">OR (Any condition matches)</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                    </Grid>

                    <Divider sx={{ my: 2 }} />
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                            Evaluation Rules
                        </Typography>
                        <Button size="small" startIcon={<AddIcon />} onClick={addCondition}>
                            Add Rule
                        </Button>
                    </Box>

                    <Stack spacing={2}>
                        {conditions.map((cond, index) => (
                            <Box key={index} sx={{ display: "flex", gap: 2, alignItems: "center" }}>
                                <FormControl size="small" sx={{ width: 180 }}>
                                    <InputLabel>Trait</InputLabel>
                                    <Select value={cond.trait} label="Trait" onChange={(e) => updateCondition(index, "trait", e.target.value)}>
                                        <MenuItem value="country">Country (Geo)</MenuItem>
                                        <MenuItem value="city">City (Geo)</MenuItem>
                                        <MenuItem value="region">Region (Geo)</MenuItem>
                                        <MenuItem value="deviceType">Device Type</MenuItem>
                                        <MenuItem value="os">Operating System</MenuItem>
                                        <MenuItem value="browser">Browser</MenuItem>
                                        <MenuItem value="userSegment">User Segment Cookie</MenuItem>
                                        <MenuItem value="isLoggedIn">Is Logged In</MenuItem>
                                    </Select>
                                </FormControl>
                                <FormControl size="small" sx={{ width: 150 }}>
                                    <InputLabel>Operator</InputLabel>
                                    <Select value={cond.operator} label="Operator" onChange={(e) => updateCondition(index, "operator", e.target.value)}>
                                        <MenuItem value="eq">Equals (eq)</MenuItem>
                                        <MenuItem value="neq">Not Equals (neq)</MenuItem>
                                        <MenuItem value="in">In List (in)</MenuItem>
                                        <MenuItem value="contains">Contains</MenuItem>
                                        <MenuItem value="gt">Greater Than (&gt;)</MenuItem>
                                        <MenuItem value="lt">Less Than (&lt;)</MenuItem>
                                        <MenuItem value="regex">Regex Match</MenuItem>
                                    </Select>
                                </FormControl>
                                <TextField
                                    size="small"
                                    fullWidth
                                    label="Value"
                                    value={cond.value}
                                    onChange={(e) => updateCondition(index, "value", e.target.value)}
                                    placeholder="e.g. US or mobile"
                                />
                                <IconButton size="small" color="error" onClick={() => removeCondition(index)}>
                                    <DeleteIcon />
                                </IconButton>
                            </Box>
                        ))}
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setOpenSegmentDialog(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleCreateSegment}>
                        Save Segment
                    </Button>
                </DialogActions>
            </Dialog>

            {/* CREATE VARIANT DIALOG */}
            <Dialog open={openVariantDialog} onClose={() => setOpenVariantDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ fontWeight: 700 }}>Create Content Variant Override</DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={3} sx={{ mt: 1 }}>
                        <TextField
                            label="Base Entry ID"
                            size="small"
                            fullWidth
                            value={baseEntryFilter}
                            disabled
                            helperText="The original content entry that will be overridden"
                        />
                        <FormControl fullWidth size="small">
                            <InputLabel>Target Audience Segment</InputLabel>
                            <Select
                                value={varSegmentId || (segments[0]?.id ?? "")}
                                label="Target Audience Segment"
                                onChange={(e) => setVarSegmentId(e.target.value)}
                            >
                                {segments.map((seg) => (
                                    <MenuItem key={seg.id} value={seg.id}>
                                        {seg.name} (P{seg.priority})
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <TextField
                            label="Field Overrides (JSON format)"
                            multiline
                            rows={6}
                            fullWidth
                            size="small"
                            value={varOverridesJson}
                            onChange={(e) => setVarOverridesJson(e.target.value)}
                            sx={{ fontFamily: "monospace" }}
                            helperText="Specify the JSON fields that will override the base entry when this segment matches"
                        />
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setOpenVariantDialog(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleCreateVariant}>
                        Save Variant
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

export default Personalization;

