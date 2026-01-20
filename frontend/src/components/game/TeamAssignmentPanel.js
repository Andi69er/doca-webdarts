const TeamAssignmentPanel = ({ gameState, user, socket, roomId }) => {
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

    const canSwitch = (targetKey) => {
        if (!socket || !roomId || !myId) {
            return false;
        }
        if (targetKey === myTeam) {
            return false;
        }
        if ((teams[targetKey]?.length || 0) >= perTeamLimit) {
            return false;
        }
        return true;
    };

    const handleSwitch = (targetKey) => {
        if (!canSwitch(targetKey)) {
            return;
        }
        socket.emit('switchTeam', { roomId, teamKey: targetKey });
    };

    const renderTeamColumn = (teamKey) => {
        const teamPlayers = teams[teamKey] || [];
        const label = teamNames[teamKey];
        const isMyTeam = myTeam === teamKey;
        const slotsLeft = Math.max(0, perTeamLimit - teamPlayers.length);
        const buttonDisabled = !canSwitch(teamKey);
        const buttonLabel = isMyTeam ? 'Dein Team' : `Zu ${label}`;

        return (
            <div className="team-column" key={teamKey}>
                <div className="team-column-header">
                    <span>{label}</span>
                    <span>{teamPlayers.length}/{perTeamLimit}</span>
                </div>
                <div className="team-player-list">
                    {teamPlayers.map((player) => (
                        <div
                            key={player.id}
                            className={`team-player${player.id === myId ? ' me' : ''}`}
                        >
                            {player.name}
                        </div>
                    ))}
                    {Array.from({ length: slotsLeft }).map((_, index) => (
                        <div key={`${teamKey}-slot-${index}`} className="team-player placeholder">
                            Frei
                        </div>
                    ))}
                </div>
                <button
                    type="button"
                    className="team-switch-btn"
                    onClick={() => handleSwitch(teamKey)}
                    disabled={buttonDisabled}
                >
                    {buttonLabel}
                </button>
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
