import { z } from 'zod';

export const EvidenceLevelEnum = z.enum([
  'Explicit',
  'Inferred',
  'Assumed',
  'Not Specified',
  'Conflict',
  'Unknown'
]);

export type EvidenceLevel = z.infer<typeof EvidenceLevelEnum>;

export const SourceAnchorSchema = z.object({
  document_version_id: z.string().min(1),
  heading_path: z.array(z.string()),
  char_offset_start: z.number().int().nonnegative(),
  char_offset_end: z.number().int().nonnegative(),
  page_number: z.number().int().optional(),
  exact_quote: z.string().min(1)
});

export const ExtractedUnitSchema = z.object({
  unit_type: z.enum(['Requirement', 'BusinessRule', 'Constraint', 'Definition']),
  subject: z.string().min(1),
  action: z.string().min(1),
  condition: z.string().optional(),
  evidence_level: EvidenceLevelEnum,
  source_anchor: SourceAnchorSchema
});

export const IntakeOutputSchema = z.object({
  normalized_text: z.string(),
  total_characters: z.number().int().nonnegative(),
  detected_language: z.enum(['vi', 'en', 'mixed']),
  security_flags: z.array(z.string())
});

export const UnderstandingOutputSchema = z.object({
  document_intent: z.string().min(1),
  executive_summary: z.string().min(1),
  target_audience: z.array(z.string()),
  key_domains: z.array(z.string())
});

export const ExtractionOutputSchema = z.object({
  extracted_units: z.array(ExtractedUnitSchema)
});

export const ClassificationOutputSchema = z.object({
  recommended_category: z.enum([
    '01_Project_Overview',
    '02_Business_Requirements',
    '03_System_Requirements',
    '04_UI_UX',
    '05_Technical_Documents',
    '06_QA',
    '07_EVD_Evidence',
    '08_Change_History'
  ]),
  confidence_score: z.number().min(0).max(1),
  reasoning: z.string().min(1)
});

export const ValidationOutputSchema = z.object({
  consistency_score: z.number().min(0).max(1),
  conflicts: z.array(z.object({
    conflict_type: z.enum(['Contradiction', 'Ambiguity', 'Redundancy']),
    severity: z.enum(['Critical', 'Major', 'Minor']),
    new_unit_quote: z.string(),
    existing_unit_quote: z.string(),
    description: z.string()
  })),
  validation_status: z.enum(['PASSED', 'WARNING', 'BLOCKED'])
});

export const OrganizationOutputSchema = z.object({
  traceability_matrix: z.array(z.object({
    unit_id: z.string(),
    target_requirement_id: z.string(),
    coverage_type: z.enum(['Full', 'Partial', 'Uncovered'])
  })),
  suggested_test_cases: z.array(z.object({
    title: z.string(),
    preconditions: z.string(),
    steps: z.array(z.string()),
    expected_result: z.string(),
    linked_unit_id: z.string()
  }))
});

// Stage 2 Combined Output Schema (E4-T4)
export const Stage2CombinedOutputSchema = z.object({
  understanding: UnderstandingOutputSchema,
  extraction: ExtractionOutputSchema,
  classification: ClassificationOutputSchema
});

export type Stage2CombinedOutput = z.infer<typeof Stage2CombinedOutputSchema>;

/**
 * BR-AI-01: Only items with 'Explicit' evidence level can be assigned 'Approved' status.
 */
export function canAutoApproveUnit(evidenceLevel: EvidenceLevel | string): boolean {
  return evidenceLevel === 'Explicit';
}
