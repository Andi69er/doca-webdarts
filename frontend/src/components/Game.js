import { useParams } from 'react-router-dom';
import { useSocket } from '../contexts/SocketContext';
import { GameProvider } from '../contexts/GameContext';
import GameLayout from './game/GameLayout';
import './Game.css';

const Game = () => {
    const { roomId } = useParams();
    const { socket } = useSocket();

    if (!roomId) {
        return null;
    }

    return (
        <GameProvider roomId={roomId} socket={socket}>
            <GameLayout />
        </GameProvider>
    );
};

export default Game;
