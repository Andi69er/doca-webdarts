import { useCallback, useRef, useState } from 'react';

const buildCompositeStream = (localStream, remoteStreams) => {
    const composite = new MediaStream();
    const added = new Set();
    const attachTracks = (stream) => {
        if (!stream) {
            return;
        }
        stream.getTracks().forEach((track) => {
            if (!added.has(track.id)) {
                composite.addTrack(track);
                added.add(track.id);
            }
        });
    };

    attachTracks(localStream);
    Object.values(remoteStreams || {}).forEach(attachTracks);
    return composite;
};

const defaultFileName = (prefix) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `${prefix}-${timestamp}.webm`;
};

const triggerDownload = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

const useRecordingManager = ({ localStream, remoteStreams, filePrefix = 'Darts-Aufnahme', mimeType = 'video/webm' } = {}) => {
    const [isRecording, setIsRecording] = useState(false);
    const [recordingError, setRecordingError] = useState(null);
    const mediaRecorderRef = useRef(null);
    const recordedChunksRef = useRef([]);

    const startRecording = useCallback(() => {
        if (isRecording) {
            return;
        }
        const composite = buildCompositeStream(localStream, remoteStreams);
        if (!composite || composite.getTracks().length === 0) {
            setRecordingError('Keine aktiven Streams für die Aufnahme verfügbar.');
            return;
        }

        recordedChunksRef.current = [];
        setRecordingError(null);

        let recorder;
        try {
            recorder = new MediaRecorder(composite, { mimeType });
        } catch (error) {
            try {
                recorder = new MediaRecorder(composite);
            } catch (fallbackError) {
                setRecordingError(fallbackError.message);
                return;
            }
        }

        mediaRecorderRef.current = recorder;
        recorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunksRef.current.push(event.data);
            }
        };
        recorder.onstop = () => {
            setIsRecording(false);
            const blob = new Blob(recordedChunksRef.current, { type: mimeType });
            triggerDownload(blob, defaultFileName(filePrefix));
        };
        recorder.start();
        setIsRecording(true);
    }, [filePrefix, isRecording, localStream, mimeType, remoteStreams]);

    const stopRecording = useCallback(() => {
        if (!mediaRecorderRef.current) {
            return;
        }
        mediaRecorderRef.current.stop();
    }, []);

    return {
        isRecording,
        recordingError,
        startRecording,
        stopRecording
    };
};

export default useRecordingManager;
