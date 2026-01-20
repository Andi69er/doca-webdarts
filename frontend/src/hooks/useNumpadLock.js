import { useState, useRef, useCallback } from 'react';

const defaultState = {
    isLocked: false,
    canUndo: false,
    lockedPlayerId: null,
    lockTimer: null
};

const useNumpadLock = () => {
    const [numpadState, setNumpadState] = useState(defaultState);
    const lockTimerRef = useRef(null);

    const clearLockTimer = useCallback(() => {
        if (lockTimerRef.current) {
            clearTimeout(lockTimerRef.current);
            lockTimerRef.current = null;
        }
        setNumpadState(prev => ({ ...prev, lockTimer: null }));
    }, []);

    const forceUnlock = useCallback(() => {
        clearLockTimer();
        setNumpadState(defaultState);
    }, [clearLockTimer]);

    const startUndoWindow = useCallback((playerId, duration = 5000) => {
        clearLockTimer();
        const timer = setTimeout(() => {
            lockTimerRef.current = null;
            setNumpadState(prev => {
                if (prev.lockTimer === timer) {
                    return defaultState;
                }
                return prev;
            });
        }, duration);
        lockTimerRef.current = timer;
        setNumpadState({
            isLocked: true,
            canUndo: true,
            lockedPlayerId: playerId,
            lockTimer: timer
        });
    }, [clearLockTimer]);

    const lockForCricket = useCallback((playerId, duration = 5000) => {
        startUndoWindow(playerId, duration);
    }, [startUndoWindow]);

    const confirmScore = useCallback(() => {
        setNumpadState(prev => {
            if (prev.lockedPlayerId !== 'remote' && prev.canUndo) {
                return { ...prev, isLocked: false };
            }
            return prev;
        });
    }, []);

    const remoteLock = useCallback((duration = 5000) => {
        clearLockTimer();
        const timer = setTimeout(() => {
            lockTimerRef.current = null;
            setNumpadState(prev => {
                if (prev.lockTimer === timer) {
                    return defaultState;
                }
                return prev;
            });
        }, duration);
        lockTimerRef.current = timer;
        setNumpadState({
            isLocked: true,
            canUndo: false,
            lockedPlayerId: 'remote',
            lockTimer: timer
        });
    }, [clearLockTimer]);

    return {
        numpadState,
        setNumpadState,
        lockForCricket,
        startUndoWindow,
        confirmScore,
        remoteLock,
        forceUnlock,
        clearLockTimer
    };
};

export default useNumpadLock;
