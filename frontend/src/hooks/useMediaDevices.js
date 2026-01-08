import { useState, useEffect, useCallback } from 'react';

const useMediaDevices = () => {
    const [devices, setDevices] = useState([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState('');

    const refreshDevices = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            const list = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = list.filter(device => device.kind === 'videoinput');
            setDevices(videoDevices);

            if (videoDevices.length > 0 && !selectedDeviceId) {
                setSelectedDeviceId(videoDevices[0].deviceId);
            }

            stream.getTracks().forEach(track => track.stop());
        } catch (error) {
            console.error('Geräte konnten nicht geladen werden:', error);
            alert('Kamera-Zugriff wurde verweigert. Die Kamera-Funktionen sind deaktiviert.');
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
