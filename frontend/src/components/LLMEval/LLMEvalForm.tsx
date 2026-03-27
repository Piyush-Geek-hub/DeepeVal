import React, { useState } from 'react';
import { FormState, MetricOption, LLMEvalResponse, FormValidationErrors, ApiError } from './types';
import { validateForm, isFormValid, getMetricsForProvider, shouldShowExpectedOutput, isContextRequired, shouldShowLLMOutput } from './validation';
import { ContextList } from './ContextList';
import { ResponsePanel } from './ResponsePanel';
import { evaluateLLM } from '../../services/llmEvalApi';

interface LLMEvalFormProps {
  onEvaluate?: (formData: FormState) => void;
}

export const LLMEvalForm: React.FC<LLMEvalFormProps> = ({ onEvaluate }) => {
  const [formState, setFormState] = useState<FormState>({
    provider: 'deepeval',
    metric: 'faithfulness',
    query: '',
    output: '',
    context: [''],
    expected_output: '',
  });

  const [response, setResponse] = useState<LLMEvalResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<FormValidationErrors>({});
  const [apiError, setApiError] = useState<ApiError | null>(null);

  const availableMetrics = getMetricsForProvider();
  const showExpectedOutput = shouldShowExpectedOutput(formState.metric);
  const contextRequired = isContextRequired(formState.metric);
  const showLLMOutput = shouldShowLLMOutput(formState.metric);

  const handleMetricChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFormState({
      ...formState,
      metric: e.target.value as MetricOption,
    });
    // Clear metric error
    if (errors.metric) {
      const newErrors = { ...errors };
      delete newErrors.metric;
      setErrors(newErrors);
    }
  };

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormState({
      ...formState,
      query: e.target.value,
    });
    // Clear query error
    if (errors.query) {
      const newErrors = { ...errors };
      delete newErrors.query;
      setErrors(newErrors);
    }
  };

  const handleOutputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setFormState({
      ...formState,
      output: e.target.value,
    });
    // Clear output error
    if (errors.output) {
      const newErrors = { ...errors };
      delete newErrors.output;
      setErrors(newErrors);
    }
  };

  const handleExpectedOutputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setFormState({
      ...formState,
      expected_output: e.target.value,
    });
    // Clear expected_output error if present
    if (errors.expected_output) {
      const newErrors = { ...errors };
      delete newErrors.expected_output;
      setErrors(newErrors);
    }
  };

  const handleContextChange = (newContext: string[]) => {
    setFormState({
      ...formState,
      context: newContext,
    });
    // Clear context errors
    if (errors.context) {
      const newErrors = { ...errors };
      delete newErrors.context;
      setErrors(newErrors);
    }
  };

  const handleAddContext = () => {
    setFormState({
      ...formState,
      context: [...formState.context, ''],
    });
  };

  const handleEvaluate = async () => {
    setApiError(null);
    setResponse(null);

    const validationErrors = validateForm(formState);
    setErrors(validationErrors);

    if (!isFormValid(validationErrors)) {
      console.log('Form validation failed:', validationErrors);
      return;
    }

    setIsLoading(true);

    try {
      console.log(`📊 Starting LLM evaluation with ${formState.provider.toUpperCase()}...`);
      const result = await evaluateLLM(formState);
      console.log('✅ LLM Evaluation successful:', result);
      setResponse(result);
    } catch (error) {
      const err = error as ApiError;
      console.error('❌ LLM Evaluation error:', err);
      setApiError(err);
    } finally {
      setIsLoading(false);
    }

    onEvaluate?.(formState);
  };

  return (
    <div className="llm-eval-form-container">
      {/* Framework Name Display Banner */}
      <div className="llm-eval-framework-banner">
        <div className="llm-eval-framework-badge">
          <span className="llm-eval-framework-label">Active Framework:</span>
          <span className="llm-eval-framework-name">🔍 DeepEval</span>
        </div>
      </div>

      {/* Active Provider Info */}
      <div className="provider-info deepeval">
        <p>
          ✓ <strong>DeepEval + RAGAS</strong> - Metrics: Faithfulness, Answer Relevancy, Contextual Precision, Contextual Recall, PII Leakage, Bias, Hallucination, RAGAS
        </p>
        <details style={{ marginTop: '0.8em', fontSize: '0.9em' }}>
          <summary style={{ cursor: 'pointer', color: '#666', fontWeight: '500' }}>
            📚 Metric Help & Examples
          </summary>
          <div style={{ marginTop: '0.8em', padding: '0.8em', backgroundColor: '#f9f9f9', borderRadius: '4px', lineHeight: '1.6' }}>
            <div style={{ marginBottom: '0.8em' }}>
              <strong>✓ Faithfulness:</strong> Evaluates if the LLM output is faithful to the retrieved context. Requires: query, output, context.
            </div>
            <div style={{ marginBottom: '0.8em' }}>
              <strong>✓ Answer Relevancy:</strong> Evaluates if the LLM output addresses the user's query. Requires: query, output.
            </div>
            <div style={{ marginBottom: '0.8em' }}>
              <strong>✓ Contextual Precision:</strong> After Retrieval - Evaluates if retrieved docs are relevant to the query. Requires: query, context, expected_output. (Output is optional)
            </div>
            <div style={{ marginBottom: '0.8em' }}>
              <strong>✓ Contextual Recall:</strong> After Retrieval - Evaluates if retrieved context has all info needed to answer the expected output. Requires: context, expected_output. (Output and query are optional)
              <br />
              <span style={{ fontSize: '0.9em', color: '#555' }}>Example: Query="Salesforce login issues?", Expected="Steps to resolve: verify username, reset password..."</span>
            </div>
            <div style={{ marginBottom: '0.8em' }}>
              <strong>✓ RAGAS:</strong> Composite RAG metric combining Faithfulness + Contextual Precision + Contextual Recall. Requires: query, context, expected_output, output.
              <br />
              <span style={{ fontSize: '0.9em', color: '#555' }}>Best for: End-to-end RAG pipeline evaluation with ground truth.</span>
            </div>
            <div style={{ marginBottom: '0.8em' }}>
              <strong>✓ PII Leakage, Bias, Hallucination:</strong> Additional quality metrics. See form labels for field requirements.
            </div>
          </div>
        </details>
      </div>

      {/* Metric Dropdown */}
      <div className="llm-eval-form-group">
        <label htmlFor="metric" className="llm-eval-form-label">
          Metric
          <span className="llm-eval-required">*</span>
        </label>
        <select
          id="metric"
          className={`llm-eval-input llm-eval-select ${errors.metric ? 'llm-eval-input-error' : ''}`}
          value={formState.metric}
          onChange={handleMetricChange}
        >
          {availableMetrics.map((metric) => (
            <option key={metric} value={metric}>
              {metric.charAt(0).toUpperCase() + metric.slice(1).replace(/_/g, ' ')}
            </option>
          ))}
        </select>
        {errors.metric && (
          <span className="llm-eval-error-message">{errors.metric}</span>
        )}
      </div>

      {/* Query Input */}
      <div className="llm-eval-form-group">
        <label htmlFor="query" className="llm-eval-form-label">
          Query/User Input
          <span className="llm-eval-required">*</span>
        </label>
        <input
          id="query"
          type="text"
          className={`llm-eval-input ${errors.query ? 'llm-eval-input-error' : ''}`}
          placeholder="Enter your query here"
          value={formState.query}
          onChange={handleQueryChange}
        />
        {errors.query && (
          <span className="llm-eval-error-message">{errors.query}</span>
        )}
      </div>

      {/* Output Textarea */}
      {showLLMOutput && (
        <div className="llm-eval-form-group">
          <label htmlFor="output" className="llm-eval-form-label">
            LLM Output/Actual output from LLM
            <span className="llm-eval-required">*</span>
          </label>
          <textarea
            id="output"
            className={`llm-eval-input llm-eval-textarea ${errors.output ? 'llm-eval-input-error' : ''}`}
            placeholder="Enter the output/response here"
            rows={4}
            value={formState.output}
            onChange={handleOutputChange}
          />
          {errors.output && (
            <span className="llm-eval-error-message">{errors.output}</span>
          )}
        </div>
      )}

      {/* Expected Output - For DeepEval contextual_recall and contextual_precision */}
      {showExpectedOutput && (
        <div className="llm-eval-form-group expected-output-group">
          <label htmlFor="expected_output" className="llm-eval-form-label expected-output-label">
            Expected Output <span className="llm-eval-required">*</span>
            <span className="label-info">
              (Required for Contextual Precision and Contextual Recall metrics)
            </span>
          </label>
          <textarea
            id="expected_output"
            className={`llm-eval-input llm-eval-textarea expected-output-textarea ${errors.expected_output ? 'llm-eval-input-error' : ''}`}
            placeholder="Enter the expected/reference answer here"
            rows={4}
            value={formState.expected_output || ''}
            onChange={handleExpectedOutputChange}
          />
          {errors.expected_output && (
            <span className="llm-eval-error-message">{errors.expected_output}</span>
          )}
        </div>
      )}

      {/* Context List */}
      <ContextList
        context={formState.context}
        onContextChange={handleContextChange}
        errors={errors.context ? [errors.context] : []}
        contextRequired={contextRequired}
      />

      {/* Evaluate Button */}
      <button
        className="llm-eval-btn llm-eval-btn-evaluate"
        onClick={handleEvaluate}
        disabled={isLoading}
      >
        {isLoading ? '⏳ Evaluating...' : '✨ Click for Evaluation'}
      </button>

      {/* API Error Display */}
      {apiError && (
        <div className="llm-eval-error-alert">
          <div className="llm-eval-error-header">
            <span className="llm-eval-error-icon">⚠️</span>
            <span className="llm-eval-error-title">Evaluation Failed</span>
          </div>
          <div className="llm-eval-error-message-box">{apiError.message}</div>
          {apiError.details && (
            <div className="llm-eval-error-details">{apiError.details}</div>
          )}
          {apiError.status && (
            <div className="llm-eval-error-status">Status Code: {apiError.status}</div>
          )}
        </div>
      )}

      {/* Response Panel */}
      <ResponsePanel response={response} isLoading={isLoading} />
    </div>
  );
};
