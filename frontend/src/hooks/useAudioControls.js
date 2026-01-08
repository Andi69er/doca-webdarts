import { useCallback, useEffect, useState } from 'react';

const useAudioControls = ({ participants = [], defaultMuted = true } = {}) => {
    const [mutedState, setMutedState] = useState({});

    useEffect(() => {
        setMutedState((prev) => {
            const next = { ...prev };
            let changed = false;
            participants.forEach((participant) => {
                if (participant.type === 'remote' && typeof next[participant.id] === 'undefined') {
                    next[participant.id] = defaultMuted;
                    changed = true;
                }
            });
            return changed ? next : prev;
        });
    }, [defaultMuted, participants]);

    const toggleMute = useCallback((targetId) => {
        setMutedState((prev) => ({
            ...prev,
            [targetId]: !prev[targetId]
        }));
    }, []);

    const setMute = useCallback((targetId, value) => {
        setMutedState((prev) => ({
            ...prev,
            [targetId]: value
        }));
    }, []);

    return {
        mutedState,
        toggleMute,
        setMute
    };
};

export default useAudioControls;
