import React, { useState } from 'react';
import { Button, Card, CardBody, CardHeader, Alert } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUpload, faCheck, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';

const RepertoireUploader = ({ onRepertoireLoad }) => {
    const [file, setFile] = useState(null);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState(null);

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const pgn = e.target.result;
                    onRepertoireLoad(pgn);
                    setSuccess(true);
                    setError(null);
                    setTimeout(() => setSuccess(false), 3000);
                } catch (err) {
                    setError(err.message);
                    setSuccess(false);
                }
            };
            reader.readAsText(file);
        }
        setFile(file);
    };

    return (
        <Card className="repertoire-uploader">
            <CardHeader>
                <FontAwesomeIcon icon={faUpload} className="mr-2" />
                Opening Repertoire
            </CardHeader>
            <CardBody>
                <p>Upload your opening repertoire in PGN format to compare your games against it.</p>
                {success && (
                    <Alert color="success" className="mb-3">
                        <FontAwesomeIcon icon={faCheck} className="mr-2" />
                        Repertoire loaded successfully!
                    </Alert>
                )}
                {error && (
                    <Alert color="danger" className="mb-3">
                        <FontAwesomeIcon icon={faExclamationTriangle} className="mr-2" />
                        {error}
                    </Alert>
                )}
                <div className="upload-section">
                    <input
                        type="file"
                        accept=".pgn"
                        onChange={handleFileChange}
                        className="file-input"
                        id="repertoire-file"
                        style={{display: 'none'}}
                    />
                    <Button
                        color="primary"
                        size="lg"
                        onClick={() => document.getElementById('repertoire-file').click()}
                    >
                        <FontAwesomeIcon icon={faUpload} className="mr-2" />
                        Choose PGN File
                    </Button>
                    {file && <p className="mt-2">Selected: {file.name}</p>}
                </div>
                <div className="mt-3">
                    <small className="text-muted">
                        Supported format: Standard PGN files containing chess moves.
                        Example: "1. e4 e5 2. Nf3 Nc6 *"
                    </small>
                </div>
            </CardBody>
        </Card>
    );
};

export default RepertoireUploader;