import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import BlockCanvas from '../components/BlockCanvas.jsx';
import { serializePageDocument } from '../lib/pageDocument.js';
import { PageRuntimeProvider } from '../runtime/PageRuntime.jsx';
import './ItemPage.css';
import './RuntimeDemoPage.css';

const DEMO_PAGE_ID = 'runtime-demo';

const DEMO_DOCUMENT = {
  id: DEMO_PAGE_ID,
  title: "Bayes' Rule Sprint",
  layout: {
    mode: 'content-plus-dock',
    dockBlockIds: ['progress-dock', 'glossary-dock', 'coach-dock'],
  },
  memory: {
    scope: 'demo:bayes-runtime-suite',
  },
  stateMachine: {
    initial: 'intro',
    current: 'intro',
    states: {
      intro: {
        visibleBlocks: ['intro-title', 'intro-text', 'intro-callout', 'intro-button', 'progress-dock', 'glossary-dock', 'coach-dock'],
        transitions: [],
      },
      practice: {
        visibleBlocks: [
          'practice-heading',
          'practice-meter',
          'mc-assessment',
          'fr-assessment',
          'slider-assessment',
          'sort-assessment',
          'progress-dock',
          'glossary-dock',
          'coach-dock',
        ],
        transitions: [
          {
            event: 'assessment:completed',
            target: 'review',
            conditions: {
              blockId: 'sort-assessment',
              passed: true,
            },
          },
        ],
      },
      review: {
        visibleBlocks: [
          'review-heading',
          'review-summary',
          'review-bound-agent-text',
          'review-agent',
          'reflection-button',
          'progress-dock',
          'glossary-dock',
          'coach-dock',
        ],
        transitions: [],
      },
    },
  },
  blocks: [
    {
      id: 'intro-title',
      type: 'heading_1',
      text: "Bayes' Rule in 7 Minutes",
    },
    {
      id: 'intro-text',
      type: 'text',
      heading: 'What you are learning',
      body: 'Bayes\' Rule updates a prior belief after seeing new evidence. The likelihood tells you how probable the evidence would be if your hypothesis were true, and the posterior is your updated belief after combining both.',
      addToMemory: [
        { term: 'prior', definition: 'Your starting belief before seeing new evidence.' },
        { term: 'likelihood', definition: 'How probable the observed evidence is under a specific hypothesis.' },
        { term: 'posterior', definition: 'Your updated belief after combining the prior and the evidence.' },
      ],
    },
    {
      id: 'intro-callout',
      type: 'callout',
      icon: '🧠',
      text: 'Watch the glossary as you move through the page. Key terms are written into shared memory and become hoverable anywhere in the lesson.',
    },
    {
      id: 'intro-button',
      type: 'button',
      heading: 'Ready to try it?',
      label: 'Start practice',
      eventName: 'button:clicked',
      targetState: 'practice',
    },
    {
      id: 'practice-heading',
      type: 'heading_2',
      text: 'Practice Round',
    },
    {
      id: 'practice-meter',
      type: 'text',
      heading: 'Reactive binding demo',
      body: 'Progress will appear here.',
      colSpan: 12,
      bind: {
        source: 'progress-dock.value',
        target: 'body',
        fallback: '0% complete',
      },
    },
    {
      id: 'mc-assessment',
      type: 'assessment',
      mode: 'multiple_choice',
      colSpan: 6,
      heading: '1. Identify the prior',
      questions: [
        {
          q: 'Before you run a medical test, what does the prior represent?',
          options: [
            'The base rate that the patient has the condition before the new test result',
            'The chance that the test machine is plugged in',
            'The posterior after seeing the evidence',
            'The ordering of diagnostic steps',
          ],
          answer: 0,
          explanation: 'The prior is the starting probability before the new evidence changes your estimate.',
        },
      ],
    },
    {
      id: 'fr-assessment',
      type: 'assessment',
      mode: 'free_response',
      colSpan: 6,
      heading: '2. Explain it in plain English',
      prompt: 'In one sentence, explain what a prior is.',
      validationRegex: 'prior|starting belief|base rate',
      explanation: 'A strong answer mentions that the prior is the starting belief before seeing new evidence.',
    },
    {
      id: 'slider-assessment',
      type: 'assessment',
      mode: 'interactive_slider',
      colSpan: 6,
      heading: '3. Choose the updated probability',
      prompt: 'If strong evidence pushes your estimate upward, move the slider close to 60%.',
      min: 0,
      max: 100,
      step: 1,
      answer: 60,
      tolerance: 5,
      unit: '%',
      explanation: 'This demonstrates tolerance-based checking for numeric answers.',
    },
    {
      id: 'sort-assessment',
      type: 'assessment',
      mode: 'drag_sort',
      colSpan: 6,
      heading: '4. Put the reasoning steps in order',
      prompt: 'Reorder the Bayes steps from start to finish. Passing this final step moves the page into review automatically.',
      items: [
        { id: 'sort-1', text: 'Start with your prior belief' },
        { id: 'sort-2', text: 'Observe the new evidence' },
        { id: 'sort-3', text: 'Weight the evidence using the likelihood' },
        { id: 'sort-4', text: 'Update to the posterior belief' },
      ],
      correctOrder: ['sort-1', 'sort-2', 'sort-3', 'sort-4'],
      explanation: 'The event bus listens for this completed assessment and the state machine transitions to review when it is correct.',
    },
    {
      id: 'review-heading',
      type: 'heading_2',
      text: 'Review',
    },
    {
      id: 'review-summary',
      type: 'text',
      colSpan: 6,
      heading: 'What changed on this page',
      body: 'You moved through page states, filled the dock progress bar through emitted events, stored glossary terms in shared memory, and triggered an auto-running review agent.',
    },
    {
      id: 'review-agent',
      type: 'agent',
      colSpan: 6,
      title: 'Review coach',
      description: 'This agent fires automatically when the page transitions into the review state.',
      prompt: 'Give the learner a short, encouraging recap of Bayes\' Rule and one next-step drill they should do next.',
      allowManualTrigger: false,
      runOn: {
        event: 'state:transition',
        conditions: {
          to: 'review',
        },
      },
    },
    {
      id: 'review-bound-agent-text',
      type: 'text',
      colSpan: 12,
      heading: 'Bound agent output',
      body: 'The review coach will write here when you reach review.',
      bind: {
        source: 'review-agent.response',
        target: 'body',
        fallback: 'Finish the final assessment to trigger the review coach.',
      },
    },
    {
      id: 'reflection-button',
      type: 'button',
      heading: 'Run it again',
      label: 'Back to intro',
      eventName: 'button:clicked',
      targetState: 'intro',
    },
    {
      id: 'progress-dock',
      type: 'progress',
      placement: 'dock',
      label: 'Lesson progress',
      total: 4,
    },
    {
      id: 'glossary-dock',
      type: 'glossary',
      placement: 'dock',
      heading: 'Course memory',
    },
    {
      id: 'coach-dock',
      type: 'agent',
      placement: 'dock',
      title: 'Need a hint?',
      description: 'Manual agent block with loading, retry, and in-block rendering.',
      prompt: 'Give one short Bayes\' Rule hint without fully solving anything. Keep it under 70 words.',
      buttonLabel: 'Ask for a hint',
    },
  ],
};

export default function RuntimeDemoPage() {
  const [document, setDocument] = useState(() => deepClone(DEMO_DOCUMENT));

  const introCopy = useMemo(() => ({
    title: 'Runtime demo',
    snippet: 'A hard-coded showcase page for layout, bindings, events, state, assessments, memory, and agent blocks.',
    tags: ['demo', 'runtime'],
    sourceName: 'Local demo',
  }), []);

  function setLayoutMode(mode) {
    setDocument(prev => serializePageDocument({
      ...prev,
      layout: {
        ...prev.layout,
        mode,
      },
    }));
  }

  function handleBlocksChange(nextBlocks) {
    setDocument(prev => serializePageDocument({
      ...prev,
      blocks: nextBlocks,
    }));
  }

  function handlePersistState(nextState) {
    setDocument(prev => serializePageDocument({
      ...prev,
      stateMachine: {
        ...prev.stateMachine,
        current: nextState,
      },
    }));
  }

  function handleReset() {
    window.localStorage.removeItem(`grabbit:page-state:${DEMO_PAGE_ID}`);
    setDocument(deepClone(DEMO_DOCUMENT));
  }

  return (
    <div className="ip demo-page">
      <div className="ip-nav">
        <Link to="/" className="ip-back">← Feed</Link>
      </div>

      <header className="ip-header">
        <div className="demo-page__eyebrow">Interactive Runtime Demo</div>
        <h1 className="ip-title">{document.title}</h1>
        <p className="ip-snippet">{introCopy.snippet}</p>

        <div className="demo-page__controls">
          <span className="demo-page__label">Preview layout:</span>
          <button className="demo-page__chip" onClick={() => setLayoutMode('single-column')}>Single Column</button>
          <button className="demo-page__chip" onClick={() => setLayoutMode('content-plus-dock')}>Content + Dock</button>
          <button className="demo-page__chip" onClick={() => setLayoutMode('dashboard-grid')}>Dashboard Grid</button>
          <button className="demo-page__chip demo-page__chip--ghost" onClick={handleReset}>Reset Demo</button>
        </div>
      </header>

      <div className="ip-divider" />

      <PageRuntimeProvider
        document={document}
        pageId={DEMO_PAGE_ID}
        onPersistState={handlePersistState}
      >
        <BlockCanvas
          blocks={document.blocks}
          layout={document.layout}
          onBlocksChange={handleBlocksChange}
          parentContext={document.title}
          pageMeta={{ memoryScope: document.memory.scope }}
        />
      </PageRuntimeProvider>
    </div>
  );
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}
