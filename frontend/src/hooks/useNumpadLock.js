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

    const lockForCricket = useCallback((playerId) => {
        setNumpadState(prev => ({
            ...prev,
            isLocked: true,
            canUndo: true,
            lockedPlayerId: playerId
        }));
    }, []);

    const startUndoWindow = useCallback((playerId, duration = 5000) => {
        clearLockTimer();
        const timer = setTimeout(() => {
            lockTimerRef.current = null;
            setNumpadState(prev => ({
                ...prev,
                isLocked: false,
                canUndo: false,
                lockedPlayerId: null,
                lockTimer: null
            }));
        }, duration);
        lockTimerRef.current = timer;
        setNumpadState(prev => ({
            ...prev,
            isLocked: false,
            canUndo: true,
            lockedPlayerId: playerId,
            lockTimer: timer
        }));
    }, [clearLockTimer]);

    return {
        numpadState,
        setNumpadState,
        lockForCricket,
        startUndoWindow,
        forceUnlock,
        clearLockTimer
    };
};

export default useNumpadLock;
