import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  getActiveState,
  getLocalStateKey,
  getStateDefinition,
  getVisibleBlocks,
} from '../lib/pageDocument.js';
import { getDefaultBindingProp } from '../lib/blockSchema.js';

const PageRuntimeContext = createContext(null);

export function PageRuntimeProvider({
  document,
  pageId,
  onPersistState,
  children,
}) {
  const storageKey = getLocalStateKey(pageId || document?.id || 'unknown');
  const eventListenersRef = useRef(new Map());
  const memoryWriteCacheRef = useRef(new Set());

  const [outputs, setOutputs] = useState({});
  const [memoryEntries, setMemoryEntries] = useState([]);
  const [memoryStatus, setMemoryStatus] = useState('idle');
  const [memoryError, setMemoryError] = useState(null);
  const [currentState, setCurrentState] = useState(() => {
    const localValue = typeof window !== 'undefined'
      ? window.localStorage.getItem(storageKey)
      : null;
    return localValue || getActiveState(document);
  });

  useEffect(() => {
    const nextState = document?.stateMachine?.current || getActiveState(document);
    setCurrentState(prev => {
      if (document?.stateMachine?.states?.[prev]) {
        return prev;
      }
      return nextState;
    });
  }, [document]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(storageKey, currentState);
    }
  }, [currentState, storageKey]);

  const bindingGraph = useMemo(() => buildBindingGraph(document?.blocks || []), [document?.blocks]);
  const circularBindings = useMemo(() => findCircularBindings(bindingGraph), [bindingGraph]);

  const emit = useCallback((eventName, payload = {}) => {
    const listeners = eventListenersRef.current.get(eventName) || [];
    const wildcard = eventListenersRef.current.get('*') || [];
    for (const listener of [...listeners, ...wildcard]) {
      listener({ eventName, payload });
    }
  }, []);

  const transitionTo = useCallback((targetState, payload = {}) => {
    if (!document?.stateMachine?.states?.[targetState] || targetState === currentState) {
      return;
    }
    const previousState = currentState;
    setCurrentState(targetState);
    onPersistState?.(targetState);
    emit('state:transition', {
      from: previousState,
      to: targetState,
      ...payload,
    });
  }, [currentState, document?.stateMachine?.states, emit, onPersistState]);

  const maybeAutoTransition = useCallback((eventName, payload = {}) => {
    const state = getStateDefinition(document, currentState);
    const transitions = state?.transitions || [];
    for (const transition of transitions) {
      if (transition.event !== eventName) continue;
      if (!matchesConditions(transition.conditions, payload)) continue;
      const target = transition.target || transition.to;
      if (target) {
        transitionTo(target, { reason: eventName, trigger: payload });
        break;
      }
    }
  }, [currentState, document, transitionTo]);

  const emitAndTransition = useCallback((eventName, payload = {}) => {
    emit(eventName, payload);
    maybeAutoTransition(eventName, payload);
  }, [emit, maybeAutoTransition]);

  const subscribe = useCallback((eventName, listener) => {
    const current = eventListenersRef.current.get(eventName) || [];
    eventListenersRef.current.set(eventName, [...current, listener]);
    return () => {
      const next = (eventListenersRef.current.get(eventName) || []).filter(item => item !== listener);
      eventListenersRef.current.set(eventName, next);
    };
  }, []);

  const setBlockOutput = useCallback((blockId, outputName, value) => {
    let changed = false;
    setOutputs(prev => {
      const currentValue = prev?.[blockId]?.[outputName];
      if (Object.is(currentValue, value)) {
        return prev;
      }
      changed = true;
      return {
        ...prev,
        [blockId]: {
          ...(prev[blockId] || {}),
          [outputName]: value,
        },
      };
    });
    if (changed) {
      emitAndTransition('binding:updated', {
        blockId,
        outputName,
        value,
      });
    }
  }, [emitAndTransition]);

  const getOutputValue = useCallback((blockId, outputName) => {
    const runtimeValue = outputs?.[blockId]?.[outputName];
    if (runtimeValue !== undefined) return runtimeValue;
    const sourceBlock = (document?.blocks || []).find(block => block.id === blockId);
    return sourceBlock?.outputs?.[outputName];
  }, [document?.blocks, outputs]);

  const resolveBindingsForBlock = useCallback((block) => {
    const descriptors = getBindingDescriptors(block);
    if (descriptors.length === 0) {
      return {
        block,
        bindingErrors: [],
      };
    }

    const nextBlock = { ...block };
    const errors = [];

    if (circularBindings.has(block.id)) {
      return {
        block: nextBlock,
        bindingErrors: ['Circular binding detected'],
      };
    }

    for (const descriptor of descriptors) {
      const parsed = parseBindingSource(descriptor.source);
      if (!parsed) {
        errors.push(`Invalid binding source "${descriptor.source}"`);
        if (descriptor.fallback !== undefined) {
          nextBlock[descriptor.target] = descriptor.fallback;
        }
        continue;
      }

      const sourceBlock = (document?.blocks || []).find(item => item.id === parsed.blockId);
      if (!sourceBlock) {
        errors.push(`Missing source block "${parsed.blockId}"`);
        nextBlock[descriptor.target] = descriptor.fallback ?? nextBlock[descriptor.target];
        continue;
      }

      const value = getOutputValue(parsed.blockId, parsed.outputName);
      if (value === undefined) {
        nextBlock[descriptor.target] = descriptor.fallback ?? nextBlock[descriptor.target];
      } else {
        nextBlock[descriptor.target] = value;
      }
    }

    return {
      block: nextBlock,
      bindingErrors: errors,
    };
  }, [circularBindings, document?.blocks, getOutputValue]);

  const refreshMemory = useCallback(async () => {
    const scope = document?.memory?.scope;
    if (!scope) {
      setMemoryEntries([]);
      return;
    }

    setMemoryStatus('loading');
    setMemoryError(null);

    try {
      const res = await fetch(`/api/memory/${encodeURIComponent(scope)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch memory');
      setMemoryEntries(data.entries || []);
      setMemoryStatus('ready');
    } catch (error) {
      setMemoryEntries([]);
      setMemoryStatus('error');
      setMemoryError(error.message);
    }
  }, [document?.memory?.scope]);

  useEffect(() => {
    refreshMemory();
  }, [refreshMemory]);

  const addToMemory = useCallback(async ({ term, definition, metadata = {}, sourceBlockId }) => {
    const scope = document?.memory?.scope;
    if (!scope || !term || !definition) return;

    const cacheKey = `${scope}:${term.toLowerCase()}:${definition}`;
    if (memoryWriteCacheRef.current.has(cacheKey)) return;
    memoryWriteCacheRef.current.add(cacheKey);

    try {
      const res = await fetch(`/api/memory/${encodeURIComponent(scope)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entries: [{ term, definition, metadata, sourceBlockId }],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to store memory');
      setMemoryEntries(data.entries || []);
    } catch (error) {
      setMemoryError(error.message);
      setMemoryStatus('error');
    }
  }, [document?.memory?.scope]);

  const value = useMemo(() => ({
    currentState,
    visibleBlocks: getVisibleBlocks(document, currentState),
    outputs,
    memoryEntries,
    memoryStatus,
    memoryError,
    setBlockOutput,
    resolveBindingsForBlock,
    emit: emitAndTransition,
    subscribe,
    transitionTo,
    addToMemory,
    refreshMemory,
  }), [
    addToMemory,
    currentState,
    document,
    emitAndTransition,
    memoryEntries,
    memoryError,
    memoryStatus,
    outputs,
    refreshMemory,
    resolveBindingsForBlock,
    setBlockOutput,
    subscribe,
    transitionTo,
  ]);

  return (
    <PageRuntimeContext.Provider value={value}>
      {children}
    </PageRuntimeContext.Provider>
  );
}

export function usePageRuntime() {
  const value = useContext(PageRuntimeContext);
  if (!value) {
    throw new Error('usePageRuntime must be used inside PageRuntimeProvider');
  }
  return value;
}

function getBindingDescriptors(block) {
  if (!block?.bind) return [];

  if (typeof block.bind.source === 'string') {
    const target = block.bind.target || getDefaultBindingProp(block.type) || 'value';
    return [{
      target,
      source: block.bind.source,
      fallback: block.bind.fallback,
    }];
  }

  return Object.entries(block.bind)
    .filter(([, config]) => config && typeof config === 'object' && typeof config.source === 'string')
    .map(([target, config]) => ({
      target,
      source: config.source,
      fallback: config.fallback,
    }));
}

function parseBindingSource(source) {
  if (typeof source !== 'string' || !source.includes('.')) return null;
  const [blockId, outputName] = source.split('.');
  if (!blockId || !outputName) return null;
  return { blockId, outputName };
}

function buildBindingGraph(blocks) {
  const graph = new Map();
  for (const block of blocks) {
    const descriptors = getBindingDescriptors(block);
    graph.set(
      block.id,
      descriptors
        .map(descriptor => parseBindingSource(descriptor.source)?.blockId)
        .filter(Boolean),
    );
  }
  return graph;
}

function findCircularBindings(graph) {
  const visited = new Set();
  const visiting = new Set();
  const cyclic = new Set();

  function visit(nodeId) {
    if (visiting.has(nodeId)) {
      cyclic.add(nodeId);
      return true;
    }
    if (visited.has(nodeId)) return false;

    visiting.add(nodeId);
    for (const next of graph.get(nodeId) || []) {
      const childCycle = visit(next);
      if (childCycle) {
        cyclic.add(nodeId);
      }
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
    return cyclic.has(nodeId);
  }

  for (const nodeId of graph.keys()) {
    visit(nodeId);
  }
  return cyclic;
}

function matchesConditions(conditions, payload) {
  if (!conditions) return true;

  return Object.entries(conditions).every(([key, expected]) => {
    const value = payload?.[key];

    if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
      if (expected.equals !== undefined) return value === expected.equals;
      if (expected.not !== undefined) return value !== expected.not;
      if (expected.in !== undefined) return Array.isArray(expected.in) && expected.in.includes(value);
      if (expected.gte !== undefined) return Number(value) >= Number(expected.gte);
      if (expected.lte !== undefined) return Number(value) <= Number(expected.lte);
    }

    if (Array.isArray(expected)) {
      return expected.includes(value);
    }

    return value === expected;
  });
}
