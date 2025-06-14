import React, { useEffect, useState } from 'react';
import './App.css';

function App() {
  const [imageUrl, setImageUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('http://localhost:5000/latest-image')
      .then(res => res.json())
      .then(data => {
        if (data.url) {
          setImageUrl(data.url);
        } else {
          setError('No image found');
        }
      })
      .catch(() => setError('Failed to fetch image'));
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <h1>Latest Image from Google Cloud Storage</h1>
        {imageUrl ? (
          <img src={imageUrl} alt="Latest from bucket" style={{ maxWidth: '80%', maxHeight: 400 }} />
        ) : error ? (
          <p>{error}</p>
        ) : (
          <p>Loading...</p>
        )}
      </header>
    </div>
  );
}

export default App;
