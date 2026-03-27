import { FormState, FormValidationErrors } from './types';

export const validateForm = (formData: FormState): FormValidationErrors => {
  const errors: FormValidationErrors = {};

  // Validate metric
  if (!formData.metric) {
    errors.metric = 'Metric is required';
  }

  // Validate query
  if (!formData.query || !formData.query.trim()) {
    errors.query = 'Query is required';
  }

  // Validate output (NOT required for contextual_precision and contextual_recall)
  const metricsNotRequiringOutput = ['contextual_precision', 'contextual_recall'];
  if (!metricsNotRequiringOutput.includes(formData.metric)) {
    if (!formData.output || !formData.output.trim()) {
      errors.output = 'Output is required';
    }
  }

  // RAGAS requires expected_output (composite metric)
  if (formData.metric === 'ragas') {
    if (!formData.expected_output || !formData.expected_output.trim()) {
      errors.expected_output = 'Expected output is required for RAGAS metric (reference/ground truth answer)';
    }
  }

  // Validate context (required for specific metrics)
  const validContexts = formData.context.filter((ctx) => ctx && ctx.trim().length > 0);
  const metricsRequiringContext = ['faithfulness', 'contextual_precision', 'contextual_recall', 'hallucination', 'ragas'];
  
  if (metricsRequiringContext.includes(formData.metric)) {
    if (validContexts.length === 0) {
      errors.context = 'At least one context item is required for this metric';
    } else {
      const emptyContexts = formData.context.filter((ctx) => !ctx || !ctx.trim());
      if (emptyContexts.length > 0) {
        errors.context = `${emptyContexts.length} context item(s) are empty`;
      }
    }
  }

  // expected_output validation - required for contextual_precision and contextual_recall
  if (formData.metric === 'contextual_precision' || formData.metric === 'contextual_recall') {
    if (!formData.expected_output || !formData.expected_output.trim()) {
      errors.expected_output = `Expected output is required for ${formData.metric} metric`;
    }
  }

  return errors;
};

export const isFormValid = (errors: FormValidationErrors): boolean => {
  return Object.keys(errors).length === 0;
};

/**
 * Get available metrics for DeepEval provider (includes RAGAS)
 */
export const getMetricsForProvider = (): string[] => {
  return ['faithfulness', 'answer_relevancy', 'contextual_precision', 'contextual_recall', 'pii_leakage', 'bias', 'hallucination', 'ragas'];
};

/**
 * Check if expected_output field should be shown
 */
export const shouldShowExpectedOutput = (metric: string): boolean => {
  // contextual_precision, contextual_recall, and ragas require expected_output
  return metric === 'contextual_precision' || metric === 'contextual_recall' || metric === 'ragas';
};

/**
 * Check if LLM output field should be shown
 */
export const shouldShowLLMOutput = (metric: string): boolean => {
  // contextual_precision and contextual_recall don't use LLM output
  // They evaluate context quality, not LLM output
  const metricsNotUsingOutput = ['contextual_precision', 'contextual_recall'];
  return !metricsNotUsingOutput.includes(metric);
};

/**
 * Check if context field is required for the metric
 */
export const isContextRequired = (metric: string): boolean => {
  // Context is required for: faithfulness, contextual_precision, contextual_recall, hallucination, ragas
  // Context is optional for: answer_relevancy, pii_leakage, bias
  const metricsRequiringContext = ['faithfulness', 'contextual_precision', 'contextual_recall', 'hallucination', 'ragas'];
  return metricsRequiringContext.includes(metric);
};

/**
 * Check if expected_output is required for the metric
 */
export const isExpectedOutputRequired = (metric: string): boolean => {
  // required for: contextual_precision, contextual_recall, ragas
  return metric === 'contextual_precision' || metric === 'contextual_recall' || metric === 'ragas';
};

