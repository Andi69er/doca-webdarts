const TeamAssignmentPanel = ({ gameState, user, socket, roomId, isHost }) => {
    const isDoublesMode = !!(gameState && gameState.teamMode === 'doubles');
    const isWaitingPhase = !gameState?.gameStatus || gameState?.gameStatus === 'waiting';

    const teamNames = {
        teamA: gameState?.teamNames?.teamA || 'Team A',
        teamB: gameState?.teamNames?.teamB || 'Team B'
    };

    const teamAssignments = gameState?.teamAssignments || {};
    const players = gameState?.players || [];

    const teams = (() => {
        const grouped = { teamA: [], teamB: [] };
        players.forEach((player) => {
            if (!player) {
                return;
            }
            let key = teamAssignments[player.id];
            if (!key) {
                key = player.teamName === teamNames.teamB ? 'teamB' : 'teamA';
            }
            if (!grouped[key]) {
                grouped[key] = [];
            }
            grouped[key].push(player);
        });
        return grouped;
    })();

    if (!isDoublesMode || !isWaitingPhase) {
        return null;
    }

    const perTeamLimit = 2;
    const myId = user?.id || socket?.id;
    const myTeam = teamAssignments[myId]
        || (teams.teamA.some((player) => player.id === myId) ? 'teamA'
            : (teams.teamB.some((player) => player.id === myId) ? 'teamB' : null));

    const canSwitch = (targetKey, playerId = myId) => {
        if (!socket || !roomId || !playerId) {
            return false;
        }
        
        const currentTeam = teamAssignments[playerId] 
            || (teams.teamA.some((p) => p.id === playerId) ? 'teamA' 
               : (teams.teamB.some((p) => p.id === playerId) ? 'teamB' : null));

        if (targetKey === currentTeam) {
            return false;
        }
        if ((teams[targetKey]?.length || 0) >= perTeamLimit) {
            return false;
        }
        return true;
    };

    const handleSwitch = (targetKey, playerId = myId) => {
        if (!canSwitch(targetKey, playerId)) {
            return;
        }
        socket.emit('switchTeam', { roomId, teamKey: targetKey, playerId });
    };

    const handleRenameTeam = (teamKey, currentName) => {
        if (!isHost) return;
        const newName = prompt('Teamname ändern:', currentName);
        if (newName && newName.trim()) {
            socket.emit('renameTeam', { roomId, teamKey, newName: newName.trim() });
        }
    };

    const renderTeamColumn = (teamKey) => {
        const teamPlayers = teams[teamKey] || [];
        const label = teamNames[teamKey];
        const isMyTeam = myTeam === teamKey;
        const slotsLeft = Math.max(0, perTeamLimit - teamPlayers.length);
        const canJoin = canSwitch(teamKey);

        return (
            <div className="team-column" key={teamKey}>
                <div className="team-column-header">
                    <span 
                        onClick={() => handleRenameTeam(teamKey, label)}
                        style={{ cursor: isHost ? 'pointer' : 'default', textDecoration: isHost ? 'underline' : 'none' }}
                        title={isHost ? 'Klicken zum Umbenennen' : ''}
                    >
                        {label} {isHost && '✏️'}
                    </span>
                    <span>{teamPlayers.length}/{perTeamLimit}</span>
                </div>
                <div className="team-player-list">
                    {teamPlayers.map((player) => (
                        <div
                            key={player.id}
                            className={`team-player${player.id === myId ? ' me' : ''}`}
                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                        >
                            <span>{player.name}</span>
                            {isHost && (
                                <button 
                                    className="host-switch-btn"
                                    onClick={() => handleSwitch(teamKey === 'teamA' ? 'teamB' : 'teamA', player.id)}
                                    title="Spieler in das andere Team verschieben"
                                    style={{ padding: '2px 5px', fontSize: '10px', marginLeft: '10px' }}
                                >
                                    ⇄
                                </button>
                            )}
                        </div>
                    ))}
                    {Array.from({ length: slotsLeft }).map((_, index) => (
                        <div key={`${teamKey}-slot-${index}`} className="team-player placeholder">
                            Frei
                        </div>
                    ))}
                </div>
                {!isMyTeam && canJoin && (
                    <button
                        type="button"
                        className="team-switch-btn"
                        onClick={() => handleSwitch(teamKey)}
                    >
                        Zu {label} wechseln
                    </button>
                )}
                {isMyTeam && (
                    <div className="team-assigned-badge">Dein Team</div>
                )}
            </div>
        );
    };

    return (
        <div className="team-assignment-panel">
            <div className="team-assignment-header">
                <span>Team-Auswahl</span>
                <span className="team-assignment-hint">Stimme dich mit deinen Mitspielern ab</span>
            </div>
            <div className="team-columns">
                {['teamA', 'teamB'].map((teamKey) => renderTeamColumn(teamKey))}
            </div>
        </div>
    );
};

export default TeamAssignmentPanel;
