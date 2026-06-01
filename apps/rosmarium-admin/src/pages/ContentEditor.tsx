import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Typography,
  Breadcrumbs,
  Link,
  Tabs,
  Tab,
  Stack,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  TextField,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import {
  Save as SaveIcon,
  Close as CancelIcon,
  Publish as PublishIcon,
  Unpublished as UnpublishIcon,
  BookmarkAdd as BookmarkAddIcon,
} from '@mui/icons-material';
import { PreviewPanel } from '../components/preview/PreviewPanel';
import type { ContentType } from '../components/content-type-builder/types';
import { FieldRenderer } from '../components/editor/FieldRenderer';
import { TooltipButton } from '../components/common/TooltipButton';
import { ScheduleDialog } from '../components/content/ScheduleDialog';
import { WorkflowTimeline } from '../components/workflow/WorkflowTimeline';
import { LocaleSwitcher } from '../components/i18n/LocaleSwitcher';
import { TranslationStatus } from '../components/i18n/TranslationStatus';
interface ContentEntry {
  id: string;
  contentType: string;
  status: 'draft' | 'published' | 'archived';
  locale?: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export function ContentEditorPage() {
  const { type, id } = useParams<{ type: string; id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'new' || !id;

  const [contentType, setContentType] = useState<ContentType | null>(null);
  const [allContentTypes, setAllContentTypes] = useState<ContentType[]>([]);
  const [entry, setEntry] = useState<ContentEntry | null>(null);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [jsonStr, setJsonStr] = useState('{}');
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [jsonError, setJsonError] = useState('');

  const [currentLocale, setCurrentLocale] = useState('en');
  const [availableLocales] = useState(['en', 'fr', 'es']);

  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [templateIsGlobal, setTemplateIsGlobal] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);

  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [scheduleAction, setScheduleAction] = useState<'publish' | 'unpublish'>('publish');

  // Fetch content type definition + entry (if editing) + all content types (for component lookup)
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        // Fetch content type schema
        const ctRes = await fetch(`/api/content-types/${type}`);
        if (!ctRes.ok) throw new Error('Failed to load content type');
        const ctJson = await ctRes.json() as { data: ContentType };
        console.log("Loaded ContentType:", ctJson);
        if (!cancelled) setContentType(ctJson.data);

        // Fetch all content types (for component / blocks lookups)
        const allRes = await fetch('/api/content-types');
        if (allRes.ok) {
          const allJson = await allRes.json() as { data: ContentType[] };
          if (!cancelled) setAllContentTypes(allJson.data ?? []);
        }

        // Fetch existing entry if editing
        if (!isNew) {
          const entryRes = await fetch(`/api/content/${type}/${id}?locale=${currentLocale}`);
          if (!entryRes.ok) throw new Error('Failed to load entry');
          const entryJson = await entryRes.json() as { data: ContentEntry };
          if (!cancelled) {
            setEntry(entryJson.data);
            setFormData(entryJson.data.data ?? {});
            setJsonStr(JSON.stringify(entryJson.data.data ?? {}, null, 2));
          }
        } else {
          // New entry: start with empty data
          const initialData: Record<string, unknown> = {};
          if (!cancelled) {
            setFormData(initialData);
            setJsonStr(JSON.stringify(initialData, null, 2));
          }
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Load failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (type) void load();
    return () => { cancelled = true; };
  }, [type, id, isNew, currentLocale]);

  const handleFieldChange = useCallback((fieldName: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [fieldName]: value }));
  }, []);

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    if (newValue === 1) {
      // Switching to JSON tab – sync form data to JSON
      setJsonStr(JSON.stringify(formData, null, 2));
      setJsonError('');
    } else {
      // Switching to Fields tab – sync JSON to form data
      try {
        const parsed = JSON.parse(jsonStr);
        setFormData(parsed as Record<string, unknown>);
        setJsonError('');
      } catch {
        setJsonError('Invalid JSON — fix errors before switching tabs');
        return; // don't switch
      }
    }
    setActiveTab(newValue);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      // If on JSON tab, parse first
      let dataToSave = formData;
      if (activeTab === 1) {
        try {
          dataToSave = JSON.parse(jsonStr) as Record<string, unknown>;
        } catch {
          setError('Invalid JSON');
          setSaving(false);
          return;
        }
      }

      const url = isNew ? `/api/content/${type}` : `/api/content/${type}/${id}`;
      const method = isNew ? 'POST' : 'PATCH';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: dataToSave, locale: currentLocale }),
      });

      if (!res.ok) {
        let errData = {};
        try { errData = await res.json(); } catch { /* ignore */ }
        throw new Error(
          (errData as { error?: { message?: string } })?.error?.message || 'Failed to save',
        );
      }

      const result = await res.json() as { data: ContentEntry };
      if (isNew) {
        // Navigate to the edit URL for the new entry
        navigate(`/content/${type}/${result.data.id}/edit`, { replace: true });
      } else {
        setEntry(result.data);
        setFormData(result.data.data ?? {});
        setJsonStr(JSON.stringify(result.data.data ?? {}, null, 2));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async (publish: boolean) => {
    if (!entry) return;
    setSaving(true);
    try {
      // Actually this is now workflow transition if a workflow is assigned, but we'll fall back to simple update
      // For this, we just update status to "published" or "draft" which might fail if workflow transitions are strictly enforced, but that's handled by the backend
      const res = await fetch(`/api/content/${type}/${entry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: publish ? 'published' : 'draft' }),
      });
      if (res.ok) {
        const result = await res.json() as { data: ContentEntry };
        setEntry(result.data);
      }
    } catch (err) {
      console.error('Publish/unpublish failed', err);
    } finally {
      setSaving(false);
    }
  };

  const handleSchedule = async (date: Date, action: 'publish' | 'unpublish') => {
    if (!entry) return;
    try {
      const res = await fetch(`/api/content/${type}/${entry.id}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, scheduledAt: date.toISOString() }),
      });
      if (!res.ok) throw new Error('Failed to schedule');
      // show success snackbar here
    } catch (err) {
      console.error('Schedule failed', err);
    }
  };

  const handleCancel = () => {
    navigate(`/content/${type}`);
  };

  const handleSaveAsTemplate = async () => {
    if (!templateName.trim()) return;
    setSavingTemplate(true);
    setError('');
    try {
      let dataToSave = formData;
      if (activeTab === 1) {
        try {
          dataToSave = JSON.parse(jsonStr) as Record<string, unknown>;
        } catch {
          setError('Invalid JSON');
          setSavingTemplate(false);
          return;
        }
      }

      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: templateName,
          description: templateDescription,
          contentTypeId: templateIsGlobal ? undefined : contentType?.id,
          templateData: dataToSave,
          isGlobal: templateIsGlobal,
        }),
      });

      if (!res.ok) {
        let errData = {};
        try { errData = await res.json(); } catch { /* ignore */ }
        throw new Error((errData as { error?: { message?: string } })?.error?.message || 'Failed to save template');
      }

      setTemplateDialogOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save template failed');
    } finally {
      setSavingTemplate(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  const entryTitle =
    String(
      (formData as Record<string, unknown>)?.title ??
      (formData as Record<string, unknown>)?.name ??
      (isNew ? 'New Entry' : entry?.id ?? ''),
    );

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto' }}>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link component={RouterLink} to="/content" underline="hover" color="inherit">
          Content
        </Link>
        <Link component={RouterLink} to={`/content/${type}`} underline="hover" color="inherit" sx={{ textTransform: 'capitalize' }}>
          {contentType?.displayName ?? type}
        </Link>
        <Typography color="text.primary">
          {entryTitle}
        </Typography>
      </Breadcrumbs>

      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <LocaleSwitcher
          currentLocale={currentLocale}
          availableLocales={availableLocales}
          onChange={setCurrentLocale}
        />
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3} sx={{ flexWrap: 'nowrap' }}>
        {/* Main Editor Area */}
        <Grid size={{ xs: 12, md: contentType?.settings?.previewUrl ? 6 : 8 }}>
          <Paper variant="outlined" sx={{ borderRadius: 2 }}>
            {/* Toolbar */}
            <Box
              sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}
            >
              <Tabs value={activeTab} onChange={handleTabChange}>
                <Tab label="Fields" />
                <Tab label="JSON" />
              </Tabs>
              <Stack direction="row" spacing={1}>
                <TooltipButton
                  actionKey="saveEntry"
                  variant="contained"
                  startIcon={<SaveIcon />}
                  onClick={() => void handleSave()}
                  disabled={saving}
                  size="small"
                >
                  {saving ? 'Saving…' : 'Save'}
                </TooltipButton>
                <TooltipButton
                  tooltipTitle="Cancel changes and go back"
                  variant="outlined"
                  startIcon={<CancelIcon />}
                  onClick={handleCancel}
                  size="small"
                >
                  Cancel
                </TooltipButton>
                {!isNew && (
                  <TooltipButton
                    tooltipTitle="Save this entry's data as a reusable template"
                    variant="outlined"
                    startIcon={<BookmarkAddIcon />}
                    onClick={() => {
                      setTemplateName('');
                      setTemplateDescription('');
                      setTemplateIsGlobal(false);
                      setTemplateDialogOpen(true);
                    }}
                    size="small"
                  >
                    Save as Template
                  </TooltipButton>
                )}
              </Stack>
            </Box>

            {/* Tab Content */}
            <Box sx={{ p: 3 }}>
              {activeTab === 0 && contentType && (
                <Stack spacing={3}>
                  {(Array.isArray(contentType.fields) ? contentType.fields : []).map((field) => (
                    <FieldRenderer
                      key={field.name}
                      field={field}
                      value={formData[field.name]}
                      onChange={handleFieldChange}
                      contentTypes={allContentTypes}
                      formData={formData}
                    />
                  ))}
                  {(!Array.isArray(contentType.fields) || contentType.fields.length === 0) && (
                    <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                      This content type has no fields defined.
                    </Typography>
                  )}
                </Stack>
              )}

              {activeTab === 1 && (
                <Box>
                  {jsonError && (
                    <Alert severity="warning" sx={{ mb: 2 }}>
                      {jsonError}
                    </Alert>
                  )}
                  <TextField
                    fullWidth
                    multiline
                    rows={24}
                    value={jsonStr}
                    onChange={(e) => setJsonStr(e.target.value)}
                    sx={{
                      '& .MuiInputBase-root': {
                        fontFamily: 'monospace',
                        fontSize: '0.875rem',
                      },
                    }}
                  />
                </Box>
              )}
            </Box>
          </Paper>
        </Grid>

        {contentType?.settings?.previewUrl && entry && (
          <Grid size={{ xs: 12, md: 6 }}>
            <PreviewPanel
              previewUrlTemplate={contentType.settings.previewUrl}
              entryId={entry.id}
              contentTypeId={contentType.id}
              formData={formData}
            />
          </Grid>
        )}

        {/* Sidebar */}
        <Grid size={{ xs: 12, md: contentType?.settings?.previewUrl ? 12 : 4 }} sx={{ display: contentType?.settings?.previewUrl ? 'none' : 'block' }}>
          <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
            <Typography variant="h3" sx={{ mb: 2 }}>
              Entry Info
            </Typography>

            {!isNew && entry && (
              <TranslationStatus
                existingLocales={[entry.locale ?? 'en']}
                missingLocales={availableLocales.filter(l => l !== (entry.locale ?? 'en'))}
              />
            )}

            <Stack spacing={2}>
              {/* Status */}
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Status
                </Typography>
                <Box sx={{ mt: 0.5 }}>
                  <Chip
                    label={entry?.status ?? 'draft'}
                    size="small"
                    color={
                      entry?.status === 'published'
                        ? 'success'
                        : entry?.status === 'draft'
                          ? 'warning'
                          : 'default'
                    }
                  />
                </Box>
              </Box>

              {/* Content Type */}
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Content Type
                </Typography>
                <Typography variant="body2">
                  {contentType?.displayName ?? type}
                </Typography>
              </Box>

              {/* Locale */}
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Locale
                </Typography>
                <Typography variant="body2">
                  {entry?.locale ?? 'en'}
                </Typography>
              </Box>

              {/* Created */}
              {entry && (
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Created
                  </Typography>
                  <Typography variant="body2">
                    {new Date(entry.createdAt).toLocaleString()}
                  </Typography>
                </Box>
              )}

              {/* Updated */}
              {entry && (
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Last Updated
                  </Typography>
                  <Typography variant="body2">
                    {new Date(entry.updatedAt).toLocaleString()}
                  </Typography>
                </Box>
              )}

              {/* Publish / Unpublish */}
              {!isNew && entry && (
                <Stack spacing={1} sx={{ mt: 1 }}>
                  {entry.status !== 'published' ? (
                    <>
                      <TooltipButton
                        tooltipTitle="Publish this entry to make it visible to clients"
                        variant="contained"
                        color="success"
                        startIcon={<PublishIcon />}
                        onClick={() => void handlePublish(true)}
                        disabled={saving}
                        fullWidth
                      >
                        Publish
                      </TooltipButton>
                      <Button
                        variant="outlined"
                        color="success"
                        size="small"
                        onClick={() => {
                          setScheduleAction('publish');
                          setScheduleDialogOpen(true);
                        }}
                      >
                        Schedule Publish...
                      </Button>
                    </>
                  ) : (
                    <>
                      <TooltipButton
                        tooltipTitle="Unpublish to hide this entry from clients"
                        variant="outlined"
                        color="warning"
                        startIcon={<UnpublishIcon />}
                        onClick={() => void handlePublish(false)}
                        disabled={saving}
                        fullWidth
                      >
                        Unpublish
                      </TooltipButton>
                      <Button
                        variant="outlined"
                        color="warning"
                        size="small"
                        onClick={() => {
                          setScheduleAction('unpublish');
                          setScheduleDialogOpen(true);
                        }}
                      >
                        Schedule Unpublish...
                      </Button>
                    </>
                  )}
                </Stack>
              )}
            </Stack>
          </Paper>

          {!isNew && entry && (
              <WorkflowTimeline entryId={entry.id} />
          )}
        </Grid>
      </Grid>

      <Dialog open={templateDialogOpen} onClose={() => !savingTemplate && setTemplateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Save as Template</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3}>
            <TextField
              label="Template Name"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              fullWidth
              autoFocus
              required
            />
            <TextField
              label="Description (Optional)"
              value={templateDescription}
              onChange={(e) => setTemplateDescription(e.target.value)}
              fullWidth
              multiline
              rows={2}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={templateIsGlobal}
                  onChange={(e) => setTemplateIsGlobal(e.target.checked)}
                />
              }
              label="Global Template (available to all content types)"
            />
            {templateIsGlobal && (
              <Alert severity="info">
                Global templates can be applied to any content type. Ensure the data structure is generic enough.
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTemplateDialogOpen(false)} disabled={savingTemplate}>Cancel</Button>
          <Button onClick={() => void handleSaveAsTemplate()} variant="contained" disabled={savingTemplate || !templateName.trim()}>
            {savingTemplate ? 'Saving…' : 'Save Template'}
          </Button>
        </DialogActions>
      </Dialog>

      <ScheduleDialog
        open={scheduleDialogOpen}
        onClose={() => setScheduleDialogOpen(false)}
        action={scheduleAction}
        onSchedule={handleSchedule}
      />
    </Box>
  );
}
