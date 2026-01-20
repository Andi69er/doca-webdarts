import { useState, useEffect, useCallback } from 'react';

const useMediaDevices = () => {
    const [devices, setDevices] = useState([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState('');

    const refreshDevices = useCallback(async () => {
        try {
            // Erst versuchen Geräte aufzulisten
            let list = await navigator.mediaDevices.enumerateDevices();
            let videoDevices = list.filter(device => device.kind === 'videoinput');
            
            // Wenn keine Labels da sind (wegen fehlender Rechte), einmal kurz anfragen
            if (videoDevices.length > 0 && !videoDevices[0].label) {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                    list = await navigator.mediaDevices.enumerateDevices();
                    videoDevices = list.filter(device => device.kind === 'videoinput');
                    stream.getTracks().forEach(track => track.stop());
                } catch (e) {
                    console.warn('Labels konnten nicht geladen werden (keine Rechte)');
                }
            }
            
            setDevices(videoDevices);

            if (videoDevices.length > 0 && !selectedDeviceId) {
                setSelectedDeviceId(videoDevices[0].deviceId);
            }
        } catch (error) {
            console.error('Geräte konnten nicht geladen werden:', error);
        }
    }, [selectedDeviceId]);

    useEffect(() => {
        refreshDevices();
    }, [refreshDevices]);

    const handleDeviceChange = useCallback((deviceId) => {
        setSelectedDeviceId(deviceId);
    }, []);

    return {
        devices,
        selectedDeviceId,
        refreshDevices,
        handleDeviceChange
    };
};

export default useMediaDevices;
