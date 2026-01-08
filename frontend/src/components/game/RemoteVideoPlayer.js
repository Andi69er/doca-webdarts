import React, { useEffect, useRef } from 'react';

const RemoteVideoPlayer = ({
    stream,
    name,
    label,
    playerId,
    muted = true,
    onToggleMute,
    onPin,
    isPinned,
    showPin = true
}) => {
    const videoRef = useRef(null);

    useEffect(() => {
        console.log(`[RemoteVideoPlayer] ${name || label} (${playerId}) - Stream verfügbar:`, !!stream);
        console.log(`[RemoteVideoPlayer] ${name || label} - Stream Details:`, stream);
        console.log(`[RemoteVideoPlayer] ${name || label} - VideoRef:`, videoRef.current);

        const videoElement = videoRef.current;

        if (videoElement && stream) {
            console.log(`[RemoteVideoPlayer] ${name || label} - Setze Stream auf Video Element`);
            try {
                videoElement.srcObject = stream;
                console.log(`[RemoteVideoPlayer] ${name || label} - ✅ srcObject gesetzt`);
            } catch (error) {
                console.error(`[RemoteVideoPlayer] ${name || label} - ❌ srcObject Fehler:`, error);
                try {
                    const mediaStream = new MediaStream();
                    stream.getTracks().forEach(track => {
                        mediaStream.addTrack(track);
                    });
                    videoElement.srcObject = mediaStream;
                    console.log(`[RemoteVideoPlayer] ${name || label} - ✅ Fallback Stream erstellt`);
                } catch (fallbackError) {
                    console.error(`[RemoteVideoPlayer] ${name || label} - ❌ Fallback Fehler:`, fallbackError);
                }
            }

            videoElement.muted = muted;
            videoElement.playsInline = true;
            videoElement.autoplay = true;
            videoElement.controls = false;
            videoElement.setAttribute('webkit-playsinline', 'true');
            videoElement.setAttribute('x-webkit-airplay', 'allow');

            const handleLoadedMetadata = () => {
                console.log(`[RemoteVideoPlayer] ${name || label} - ✅ Video Metadata geladen`);
                console.log(`[RemoteVideoPlayer] ${name || label} - Video Dimensions:`, {
                    videoWidth: videoElement.videoWidth,
                    videoHeight: videoElement.videoHeight
                });
            };

            const handleCanPlay = () => {
                console.log(`[RemoteVideoPlayer] ${name || label} - ✅ Video kann abgespielt werden`);
            };

            const handlePlay = () => {
                console.log(`[RemoteVideoPlayer] ${name || label} - ✅ Video spielt ab`);
            };

            const handleError = (error) => {
                console.error(`[RemoteVideoPlayer] ${name || label} - ❌ Video Fehler:`, error);
                console.error(`[RemoteVideoPlayer] ${name || label} - Video Error Details:`, videoElement.error);
            };

            const handleLoadStart = () => {
                console.log(`[RemoteVideoPlayer] ${name || label} - 🔄 Video Load Start`);
            };

            const handleAbort = () => {
                console.log(`[RemoteVideoPlayer] ${name || label} - ⚠️ Video Load Abort`);
            };

            videoElement.addEventListener('loadedmetadata', handleLoadedMetadata);
            videoElement.addEventListener('canplay', handleCanPlay);
            videoElement.addEventListener('play', handlePlay);
            videoElement.addEventListener('error', handleError);
            videoElement.addEventListener('loadstart', handleLoadStart);
            videoElement.addEventListener('abort', handleAbort);

            const startVideo = () => {
                if (!videoElement) {
                    return;
                }
                const playPromise = videoElement.play();
                if (playPromise !== undefined) {
                    playPromise.then(() => {
                        console.log(`[RemoteVideoPlayer] ${name || label} - ✅ Video erfolgreich gestartet`);
                    }).catch(error => {
                        console.error(`[RemoteVideoPlayer] ${name || label} - ❌ Autoplay Fehler:`, error);
                        setTimeout(() => {
                            if (videoElement) {
                                videoElement.play().catch(e => {
                                    console.error(`[RemoteVideoPlayer] ${name || label} - ❌ Retry Fehler:`, e);
                                });
                            }
                        }, 1000);
                    });
                }
            };

            setTimeout(startVideo, 100);

            return () => {
                if (videoElement) {
                    videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
                    videoElement.removeEventListener('canplay', handleCanPlay);
                    videoElement.removeEventListener('play', handlePlay);
                    videoElement.removeEventListener('error', handleError);
                    videoElement.removeEventListener('loadstart', handleLoadStart);
                    videoElement.removeEventListener('abort', handleAbort);
                }
            };
        } else if (!stream) {
            console.log(`[RemoteVideoPlayer] ${name || label} - ❌ Kein Stream verfügbar`);
            if (videoElement) {
                videoElement.srcObject = null;
            }
        }
    }, [stream, name, label, playerId, muted]);

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.muted = muted;
        }
    }, [muted]);

    if (!stream) {
        return (
            <div className="remote-video-wrapper video-tile video-tile--empty">
                <div className="video-label">{label || name} - Kein Stream</div>
                <div>Warte auf Videoverbindung...</div>
            </div>
        );
    }

    return (
        <div className={`remote-video-wrapper video-tile ${isPinned ? 'video-tile--pinned' : ''}`}>
            <div className="video-label">
                <span>{label || name}</span>
                {showPin && (
                    <button type="button" className="video-pin" onClick={onPin} title="Kamera fixieren">
                        {isPinned ? '📌' : '📍'}
                    </button>
                )}
            </div>
            <video
                ref={videoRef}
                playsInline
                autoPlay
                muted={muted}
                style={{ width: '100%', height: '100%', objectFit: 'cover', backgroundColor: '#000' }}
            />
            <div className="video-actions">
                {onToggleMute && (
                    <button type="button" onClick={onToggleMute}>
                        {muted ? '🔇 Ton aus' : '🔊 Ton an'}
                    </button>
                )}
            </div>
        </div>
    );
};

export default RemoteVideoPlayer;
