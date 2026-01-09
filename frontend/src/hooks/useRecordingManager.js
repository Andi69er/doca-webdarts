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
    const captureStreamRef = useRef(null);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        if (captureStreamRef.current) {
            captureStreamRef.current.getTracks().forEach((track) => track.stop());
            captureStreamRef.current = null;
        }
    }, []);

    const startRecording = useCallback(async () => {
        if (isRecording) {
            return;
        }
        if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
            setRecordingError('Aufnahme ist in diesem Browser nicht verfügbar.');
            return;
        }

        const beginRecording = (stream) => {
            recordedChunksRef.current = [];
            let recorder = null;
            try {
                recorder = new MediaRecorder(stream, { mimeType });
            } catch (error) {
                try {
                    recorder = new MediaRecorder(stream);
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
        };

        setRecordingError(null);

        try {
            const displayStream = await navigator.mediaDevices.getDisplayMedia({
                video: { frameRate: 30 },
                audio: true
            });
            captureStreamRef.current = displayStream;
            displayStream.getTracks().forEach((track) => {
                track.addEventListener('ended', stopRecording, { once: true });
            });
            beginRecording(displayStream);
            return;
        } catch (displayError) {
            console.warn('Display capture failed, falling back to in-app streams', displayError);
            captureStreamRef.current = null;
        }

        const composite = buildCompositeStream(localStream, remoteStreams);
        if (!composite || composite.getTracks().length === 0) {
            setRecordingError('Bildschirmaufnahme abgelehnt oder keine Streams verfügbar.');
            return;
        }
        beginRecording(composite);
    }, [filePrefix, isRecording, localStream, mimeType, remoteStreams, stopRecording]);

    return {
        isRecording,
        recordingError,
        startRecording,
        stopRecording
    };
};

export default useRecordingManager;
