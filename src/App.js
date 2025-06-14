import React, { useState } from 'react';
import './App.css';

function App() {
  const [imageUrl, setImageUrl] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [prediction, setPrediction] = useState(null);
  const [predicting, setPredicting] = useState(false);

  const fetchLatestImage = () => {
    setLoading(true);
    setError(null);
    setPrediction(null);
    fetch('http://localhost:5000/latest-image')
      .then(res => res.json())
      .then(data => {
        if (data.url) {
          setImageUrl(data.url);
        } else {
          setError('No image found');
        }
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to fetch image');
        setLoading(false);
      });
  };

  const handlePredict = () => {
    setPredicting(true);
    setPrediction(null);
    setError(null);
    fetch('http://localhost:5000/predict-latest-image', { method: 'POST' })
      .then(res => res.json())
      .then(data => {
        setPrediction(data);
        setPredicting(false);
      })
      .catch(() => {
        setError('Prediction failed');
        setPredicting(false);
      });
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Latest Image from Google Cloud Storage</h1>
        <button onClick={fetchLatestImage} style={{ marginBottom: 20 }}>
          Get Latest Image
        </button>
        {loading ? (
          <p>Loading...</p>
        ) : imageUrl ? (
          <>
            <img src={imageUrl} alt="Latest from bucket" style={{ maxWidth: '80%', maxHeight: 400 }} />
            <br />
            <button onClick={handlePredict} style={{ marginTop: 20 }} disabled={predicting}>
              {predicting ? 'Predicting...' : 'Run Object Detection'}
            </button>
            {prediction && (
              <div style={{ marginTop: 20, textAlign: 'left', maxWidth: 600 }}>
                <h3>Prediction Result:</h3>
                <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{JSON.stringify(prediction, null, 2)}</pre>
              </div>
            )}
          </>
        ) : error ? (
          <p>{error}</p>
        ) : (
          <p>Click the button to load the latest image.</p>
        )}
      </header>
    </div>
  );
}

export default App;
