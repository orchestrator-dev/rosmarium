import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, Paper, Stack, IconButton, Stepper, Step, StepLabel } from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { ContentType, FieldDefinition, ContentTypeInput } from './types';
import { StepBasicInfo } from './StepBasicInfo';
import { StepFields } from './StepFields';
import { StepAISettings } from './StepAISettings';
import { StepGraphSettings, EdgeType } from './StepGraphSettings';
import { StepReview } from './StepReview';

export interface ContentTypeWizardProps {
  existingType?: ContentType;
  onClose: () => void;
  onSave: (payload: ContentTypeInput, isEdit: boolean) => Promise<void>;
}

export function ContentTypeWizard({ existingType, onClose, onSave }: ContentTypeWizardProps) {
  const [activeStep, setActiveStep] = useState(0);

  // Basic Info
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [isComponent, setIsComponent] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');

  // Fields
  const [fields, setFields] = useState<FieldDefinition[]>([]);

  // AI Config
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiOperations, setAiOperations] = useState<string[]>([]);
  const [taxonomyTags, setTaxonomyTags] = useState<string[]>([]);

  // Graph Config
  const [graphEnabled, setGraphEnabled] = useState(false);
  const [edgeTypes, setEdgeTypes] = useState<EdgeType[]>([]);
  const [autoInferNer, setAutoInferNer] = useState(false);
  const [autoInferSimilarity, setAutoInferSimilarity] = useState(false);
  const [similarityThreshold, setSimilarityThreshold] = useState(0.8);

  useEffect(() => {
    if (existingType) {
      setName(existingType.name);
      setDisplayName(existingType.displayName);
      setDescription(existingType.description || '');
      setFields(existingType.fields || []);
      setIsComponent(existingType.isComponent || false);
      
      if (existingType.settings?.ai?.enabled) {
        setAiEnabled(true);
        setAiOperations(existingType.settings.ai.operations || []);
        setTaxonomyTags(existingType.settings.ai.taxonomy || []);
      }
      if (existingType.settings?.graph?.enabled) {
        setGraphEnabled(true);
        setEdgeTypes(existingType.settings.graph.edgeTypes || []);
        setAutoInferNer(existingType.settings.graph.autoInferNer || false);
        setAutoInferSimilarity(existingType.settings.graph.autoInferSimilarity || false);
        setSimilarityThreshold(existingType.settings.graph.similarityThreshold || 0.8);
      }
      if (existingType.settings?.previewUrl) {
        setPreviewUrl(existingType.settings.previewUrl);
      }
    }
  }, [existingType]);

  const handleNext = () => setActiveStep(prev => prev + 1);
  const handleBack = () => setActiveStep(prev => prev - 1);

  const buildPayload = (): ContentTypeInput => ({
    name,
    displayName,
    description,
    fields,
    isComponent,
    settings: {
      ai: { enabled: aiEnabled, operations: aiOperations, taxonomy: taxonomyTags },
      graph: { enabled: graphEnabled, edgeTypes, autoInferNer, autoInferSimilarity, similarityThreshold },
      previewUrl: previewUrl || undefined
    }
  });

  const handleSave = async () => {
    await onSave(buildPayload(), !!existingType);
  };

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      <Stack direction="row" sx={{ alignItems: "center", mb: 4 }} spacing={2}>
        <IconButton onClick={onClose}><ArrowBackIcon /></IconButton>
        <Typography variant="h4">{existingType ? 'Edit Content Type' : 'New Content Type'}</Typography>
      </Stack>

      <Paper sx={{ p: 4, mb: 4 }}>
        <Stepper activeStep={activeStep} sx={{ mb: 4 }} alternativeLabel>
          <Step><StepLabel>Basic Details</StepLabel></Step>
          <Step><StepLabel>Fields</StepLabel></Step>
          <Step><StepLabel>AI Intelligence</StepLabel></Step>
          <Step><StepLabel>Knowledge Graph</StepLabel></Step>
          <Step><StepLabel>Review</StepLabel></Step>
        </Stepper>

        {activeStep === 0 && (
          <StepBasicInfo
            displayName={displayName} setDisplayName={setDisplayName}
            name={name} setName={setName}
            description={description} setDescription={setDescription}
            isComponent={isComponent} onIsComponentChange={setIsComponent}
            previewUrl={previewUrl} setPreviewUrl={setPreviewUrl}
          />
        )}

        {activeStep === 1 && (
          <StepFields fields={fields} setFields={setFields} />
        )}

        {activeStep === 2 && (
          <StepAISettings
            aiEnabled={aiEnabled} setAiEnabled={setAiEnabled}
            aiOperations={aiOperations} setAiOperations={setAiOperations}
            taxonomyTags={taxonomyTags} setTaxonomyTags={setTaxonomyTags}
          />
        )}

        {activeStep === 3 && (
          <StepGraphSettings
            graphEnabled={graphEnabled} setGraphEnabled={setGraphEnabled}
            edgeTypes={edgeTypes} setEdgeTypes={setEdgeTypes}
            autoInferNer={autoInferNer} setAutoInferNer={setAutoInferNer}
            autoInferSimilarity={autoInferSimilarity} setAutoInferSimilarity={setAutoInferSimilarity}
            similarityThreshold={similarityThreshold} setSimilarityThreshold={setSimilarityThreshold}
          />
        )}

        {activeStep === 4 && (
          <StepReview payload={buildPayload()} />
        )}

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 4, gap: 2 }}>
          <Button disabled={activeStep === 0} onClick={handleBack}>Back</Button>
          {activeStep === 4 ? (
            <Button variant="contained" onClick={() => void handleSave()} disabled={!name || !displayName || fields.length === 0}>
              Save Content Type
            </Button>
          ) : (
            <Button variant="contained" onClick={handleNext} disabled={activeStep === 0 && (!name || !displayName)}>
              Next
            </Button>
          )}
        </Box>
      </Paper>
    </Box>
  );
}
