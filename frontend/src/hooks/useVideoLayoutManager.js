import { useCallback, useMemo } from 'react';

const useVideoLayoutManager = ({
    videoLayout,
    participants = [],
    gameState,
    userId,
    setManualVideoLayout,
    resetVideoLayout
} = {}) => {
    const activePlayerId = useMemo(() => {
        const index = gameState?.currentPlayerIndex ?? gameState?.gameState?.currentPlayerIndex ?? 0;
        return gameState?.players?.[index]?.id;
    }, [gameState?.currentPlayerIndex, gameState?.gameState?.currentPlayerIndex, gameState?.players]);

    const focusId = useMemo(() => {
        if (videoLayout?.currentPlayerId) {
            return videoLayout.currentPlayerId === 'local' ? 'local' : videoLayout.currentPlayerId;
        }
        if (activePlayerId) {
            return activePlayerId === userId ? 'local' : activePlayerId;
        }
        return 'local';
    }, [activePlayerId, userId, videoLayout?.currentPlayerId]);

    const isGameActive = gameState?.gameStatus === 'active';
    const isGameFinished = gameState?.gameStatus === 'finished';
    const tileCount = participants.length;

    const isGridMode = useMemo(() => {
        // Im Doppel-Modus am Anfang (waiting) und Ende (finished) immer Grid zeigen (4 Fenster)
        if (!isGameActive || isGameFinished) {
            return true;
        }
        if (videoLayout?.manual) {
            return videoLayout.mode === 'splitscreen';
        }
        // Standardmäßig im Spiel Fokus-Modus
        return videoLayout?.mode !== 'fullscreen';
    }, [isGameActive, isGameFinished, videoLayout?.manual, videoLayout?.mode]);

    const gridClass = useMemo(() => {
        if (!isGridMode) {
            return 'fullscreen';
        }
        if (videoLayout?.mode === 'splitscreen') {
            return 'grid-splitscreen';
        }
        if (tileCount >= 4) {
            return 'grid-4';
        }
        if (tileCount >= 2) {
            return 'grid-2';
        }
        return 'grid-1';
    }, [isGridMode, tileCount, videoLayout?.mode]);

    const pinnedId = useMemo(() => {
        if (!videoLayout?.currentPlayerId) {
            return null;
        }
        return videoLayout.currentPlayerId === 'local' ? 'local' : videoLayout.currentPlayerId;
    }, [videoLayout?.currentPlayerId]);

    const tileClassName = useCallback((tileId) => {
        if (isGridMode) {
            return 'video-tile';
        }
        if (tileId === focusId) {
            return 'video-tile video-tile--focus';
        }
        return 'video-tile video-tile--hidden';
    }, [focusId, isGridMode]);

    const pinParticipant = useCallback((targetId) => {
        if (!setManualVideoLayout) {
            return;
        }
        setManualVideoLayout({ mode: 'fullscreen', currentPlayerId: targetId });
    }, [setManualVideoLayout]);

    const showSplitscreen = useCallback(() => {
        setManualVideoLayout?.({ mode: 'splitscreen', currentPlayerId: null });
    }, [setManualVideoLayout]);

    return {
        focusId,
        pinnedId,
        gridClass,
        isGridMode,
        tileClassName,
        pinParticipant,
        showSplitscreen,
        resetVideoLayout
    };
};

export default useVideoLayoutManager;
