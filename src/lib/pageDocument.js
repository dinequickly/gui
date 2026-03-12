const DEFAULT_LAYOUT = {
  mode: 'single-column',
  dockBlockIds: [],
  columns: 12,
};

export function normalizePageDocument(data, { pageId, pageType = 'page' } = {}) {
  const raw = Array.isArray(data) ? { blocks: data } : (data || {});
  const blocks = Array.isArray(raw.blocks) ? raw.blocks : [];
  const stateMachine = normalizeStateMachine(raw.stateMachine, blocks);

  return {
    version: 2,
    id: raw.id || pageId || null,
    pageType: raw.pageType || pageType,
    title: raw.title || '',
    layout: normalizeLayout(raw.layout),
    blocks: blocks.map(normalizeBlock),
    stateMachine,
    memory: normalizeMemory(raw.memory, pageId),
  };
}

export function serializePageDocument(document) {
  return {
    version: 2,
    id: document.id || null,
    pageType: document.pageType || 'page',
    title: document.title || '',
    layout: normalizeLayout(document.layout),
    blocks: Array.isArray(document.blocks) ? document.blocks.map(normalizeBlock) : [],
    stateMachine: normalizeStateMachine(document.stateMachine, document.blocks || []),
    memory: normalizeMemory(document.memory, document.id),
  };
}

export function normalizeLayout(layout) {
  if (typeof layout === 'string') {
    return { ...DEFAULT_LAYOUT, mode: layout };
  }

  return {
    ...DEFAULT_LAYOUT,
    ...(layout || {}),
    dockBlockIds: Array.isArray(layout?.dockBlockIds) ? layout.dockBlockIds : [],
  };
}

export function normalizeMemory(memory, pageId) {
  return {
    scope: memory?.scope || memory?.workspaceScope || `page:${pageId || 'unknown'}`,
  };
}

export function normalizeStateMachine(stateMachine, blocks = []) {
  const states = stateMachine?.states && typeof stateMachine.states === 'object'
    ? stateMachine.states
    : {};

  const stateKeys = Object.keys(states);
  const fallbackInitial = stateKeys[0] || 'default';
  const initial = stateMachine?.initial || fallbackInitial;

  return {
    initial,
    current: stateMachine?.current || initial,
    states: stateKeys.length > 0 ? states : {
      default: {
        visibleBlocks: [],
        transitions: [],
      },
    },
  };
}

export function normalizeBlock(block = {}, index = 0) {
  return {
    ...block,
    id: block.id || `block-${index + 1}`,
  };
}

export function getActiveState(document) {
  const machine = document?.stateMachine;
  if (!machine) return 'default';
  if (machine.current && machine.states?.[machine.current]) return machine.current;
  if (machine.initial && machine.states?.[machine.initial]) return machine.initial;
  return Object.keys(machine.states || {})[0] || 'default';
}

export function getStateDefinition(document, stateName) {
  return document?.stateMachine?.states?.[stateName] || null;
}

export function isDockBlock(block, layout) {
  return Boolean(block?.placement === 'dock' || layout?.dockBlockIds?.includes(block?.id));
}

export function getVisibleBlocks(document, currentState) {
  const state = getStateDefinition(document, currentState);
  const visibleIds = state?.visibleBlocks;
  const hiddenIds = new Set(state?.hiddenBlocks || []);

  return (document?.blocks || []).filter(block => {
    const visibleInState = Array.isArray(block.visibleInStates)
      ? block.visibleInStates.includes(currentState)
      : true;
    const hiddenInState = Array.isArray(block.hiddenInStates)
      ? block.hiddenInStates.includes(currentState)
      : false;

    if (!visibleInState || hiddenInState || hiddenIds.has(block.id)) {
      return false;
    }

    if (Array.isArray(visibleIds) && visibleIds.length > 0) {
      return visibleIds.includes(block.id);
    }

    return true;
  });
}

export function getLocalStateKey(pageId) {
  return `grabbit:page-state:${pageId}`;
}

export function getLocalLayoutKey(pageId) {
  return `grabbit:page-layout:${pageId}`;
}

export function getLayoutClassName(mode) {
  switch (mode) {
    case 'content-plus-dock':
      return 'block-canvas--dock';
    case 'dashboard-grid':
      return 'block-canvas--grid';
    default:
      return 'block-canvas--single';
  }
}
