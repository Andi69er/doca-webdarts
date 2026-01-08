import { useCallback } from 'react';
import useMediaDevices from './useMediaDevices';
import useWebRTC from './useWebRTC';

const useCameraController = ({ socket, roomId, gameState, user } = {}) => {
    const { devices, selectedDeviceId, refreshDevices, handleDeviceChange } = useMediaDevices();
    const {
        localVideoRef,
        localStream,
        remoteStreams,
        isCameraEnabled,
        startCamera: startWebRtcCamera,
        stopCamera,
        autoConnectToOpponents
    } = useWebRTC({ socket, roomId, gameState, user, selectedDeviceId, refreshDevices });

    const startCamera = useCallback((deviceId) => {
        const targetId = deviceId || selectedDeviceId;
        if (deviceId && deviceId !== selectedDeviceId) {
            handleDeviceChange(deviceId);
        }
        return startWebRtcCamera(targetId);
    }, [handleDeviceChange, selectedDeviceId, startWebRtcCamera]);

    const selectDevice = useCallback((deviceId, { restart = false } = {}) => {
        handleDeviceChange(deviceId);
        if (restart && isCameraEnabled) {
            startWebRtcCamera(deviceId);
        }
    }, [handleDeviceChange, isCameraEnabled, startWebRtcCamera]);

    return {
        devices,
        selectedDeviceId,
        selectDevice,
        refreshDevices,
        localVideoRef,
        localStream,
        remoteStreams,
        isCameraEnabled,
        startCamera,
        stopCamera,
        autoConnectToOpponents
    };
};

export default useCameraController;
