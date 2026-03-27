import React, { useState } from 'react';
import { LLMEvalPage } from './pages/LLMEvalPage';
import BatchEvaluationPage from './pages/BatchEvaluationPage';
import './styles/app-nav.css';

function App() {
  const [activeTab, setActiveTab] = useState<'single' | 'batch'>('single');

  return (
    <div className="app-container">
      <nav className="app-nav">
        <div className="app-nav-content">
          <button
            className={`nav-tab ${activeTab === 'single' ? 'active' : ''}`}
            onClick={() => setActiveTab('single')}
          >
            📝 Single Evaluation
          </button>
          <button
            className={`nav-tab ${activeTab === 'batch' ? 'active' : ''}`}
            onClick={() => setActiveTab('batch')}
          >
            📊 Batch Evaluation
          </button>
        </div>
      </nav>

      <div className="app-content">
        {activeTab === 'single' && <LLMEvalPage />}
        {activeTab === 'batch' && <BatchEvaluationPage />}
      </div>
    </div>
  );
}

export default App;
