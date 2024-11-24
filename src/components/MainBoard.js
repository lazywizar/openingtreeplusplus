import RepertoireUploader from './RepertoireUploader';
import RepertoireService from '../services/RepertoireService';

const handleRepertoireLoad = (pgn) => {
    RepertoireService.loadRepertoire(pgn);
    // Trigger a re-render of moves if needed
};

<RepertoireUploader onRepertoireLoad={handleRepertoireLoad} />