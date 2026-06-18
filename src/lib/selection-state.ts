type SelectionTransition = {
  selectedTargetId: string;
  selectedTargetIds: string[];
  isolationPath: string[];
};

type NormalizedSelectionState = SelectionTransition & {
  selectedLayerId: string;
  selectedClipId: string;
  isolatedGroupId: string;
};

type CanvasClickInput = {
  currentTargetId: string;
  isolationPath: string[];
  hitPath: string[];
  modifier: boolean;
};

type DrillInInput = {
  currentTargetId: string;
  isolationPath: string[];
  hitPath: string[];
};

type EscapeInput = {
  selectedTargetId: string;
  isolationPath: string[];
};

type DefaultDrillInput = {
  currentTargetId: string;
  isolationPath: string[];
  defaultChildId: string;
};

type NormalizeSelectionInput = {
  selectedTargetId: string;
  selectedTargetIds: string[];
  selectedLayerId: string;
  selectedClipId: string;
  isolationPath: string[];
  activePathIds?: string[];
};

export const normalizeSelectionState = ({
  selectedTargetId,
  selectedTargetIds,
  selectedLayerId,
  selectedClipId,
  isolationPath,
  activePathIds,
}: NormalizeSelectionInput): NormalizedSelectionState => {
  if (!selectedTargetId && !selectedTargetIds.length) {
    return {
      selectedTargetId: '',
      selectedTargetIds: [],
      selectedLayerId: '',
      selectedClipId: '',
      isolationPath: [],
      isolatedGroupId: '',
    };
  }

  const prunedPath = activePathIds?.length
    ? isolationPath.filter((targetId) => activePathIds.includes(targetId))
    : isolationPath;

  return {
    selectedTargetId,
    selectedTargetIds,
    selectedLayerId,
    selectedClipId,
    isolationPath: prunedPath,
    isolatedGroupId: prunedPath[0] || '',
  };
};

export const defaultHitPathForDrillIn = ({ currentTargetId, isolationPath, defaultChildId }: DefaultDrillInput): string[] | null => {
  if (!currentTargetId || !defaultChildId) return null;
  const parentPath = isolationPath.at(-1) === currentTargetId
    ? isolationPath
    : [...isolationPath, currentTargetId];
  return [...parentPath, defaultChildId];
};

export const nextSelectionForCanvasClick = ({ isolationPath, hitPath, modifier }: CanvasClickInput): SelectionTransition | null => {
  if (!hitPath?.length) return null;
  if (modifier) return null;
  if (!isolationPath.length && hitPath.length > 1 && hitPath[0] !== 'group:offers-block') {
    const selectedTargetId = hitPath[hitPath.length - 1];
    return {
      selectedTargetId,
      selectedTargetIds: [selectedTargetId],
      isolationPath: hitPath.slice(0, -1),
    };
  }
  const depth = isolationPath.length;
  const selectedIndex = Math.min(depth, hitPath.length - 1);
  const selectedTargetId = hitPath[selectedIndex];
  return {
    selectedTargetId,
    selectedTargetIds: [selectedTargetId],
    isolationPath: hitPath.slice(0, selectedIndex),
  };
};

export const nextSelectionForDrillIn = ({ currentTargetId, hitPath }: DrillInInput): SelectionTransition | null => {
  if (!hitPath?.length) return null;
  const currentIndex = Math.max(0, hitPath.indexOf(currentTargetId));
  const nextIndex = Math.min(hitPath.length - 1, currentIndex + 1);
  const selectedTargetId = hitPath[nextIndex];
  return {
    selectedTargetId,
    selectedTargetIds: [selectedTargetId],
    isolationPath: hitPath.slice(0, nextIndex),
  };
};

export const nextSelectionForEscape = ({ isolationPath }: EscapeInput): SelectionTransition | null => {
  if (!isolationPath?.length) return null;
  const nextPath = isolationPath.slice(0, -1);
  const selected = isolationPath[isolationPath.length - 1];
  return {
    selectedTargetId: selected,
    selectedTargetIds: [selected],
    isolationPath: nextPath,
  };
};
