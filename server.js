// Simple Express server to fetch the latest image from a Google Cloud Storage bucket
require('dotenv').config();
const express = require('express');
const { Storage } = require('@google-cloud/storage');
const cors = require('cors');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 5000; // You can change this if needed

app.use(cors());

// TODO: Replace with your bucket name
const BUCKET_NAME = process.env.GCLOUD_BUCKET_NAME;
const GCLOUD_PROJECT = process.env.GCLOUD_PROJECT;
// Optional: set a prefix if your images are in a subfolder
const PREFIX = '';

// Instantiates a client. Make sure GOOGLE_APPLICATION_CREDENTIALS is set
const storage = new Storage({ projectId: GCLOUD_PROJECT });

app.get('/latest-image', async (req, res) => {
  try {
    const [files] = await storage.bucket(BUCKET_NAME).getFiles({ prefix: PREFIX });
    // Filter for image files (jpg, png, etc.)
    const imageFiles = files.filter(file => /\.(jpg|jpeg|png|gif)$/i.test(file.name));
    if (imageFiles.length === 0) {
      return res.status(404).json({ error: 'No images found' });
    }
    // Sort by updated time descending
    imageFiles.sort((a, b) => new Date(b.metadata.updated) - new Date(a.metadata.updated));
    const latestImage = imageFiles[0];
    // Get a signed URL (valid for 10 minutes)
    const [url] = await latestImage.getSignedUrl({
      action: 'read',
      expires: Date.now() + 10 * 60 * 1000,
    });
    res.json({ url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch image' });
  }
});

app.post('/predict-latest-image', async (req, res) => {
  try {
    const [files] = await storage.bucket(BUCKET_NAME).getFiles({ prefix: PREFIX });
    const imageFiles = files.filter(file => /\.(jpg|jpeg|png|gif)$/i.test(file.name));
    if (imageFiles.length === 0) {
      return res.status(404).json({ error: 'No images found' });
    }
    imageFiles.sort((a, b) => new Date(b.metadata.updated) - new Date(a.metadata.updated));
    const latestImage = imageFiles[0];
    // Download the image to a temp file
    const tempFilePath = path.join(__dirname, 'latest-image.jpg');
    await latestImage.download({ destination: tempFilePath });

    // Call the Python script for prediction
    const pythonProcess = spawn('python3', [
      path.join(__dirname, 'imageObjectIdentify.py'),
      tempFilePath // Pass image path as argument (modify script to accept this if needed)
    ]);

    let result = '';
    let error = '';
    pythonProcess.stdout.on('data', data => {
      result += data.toString();
    });
    pythonProcess.stderr.on('data', data => {
      error += data.toString();
    });
    pythonProcess.on('close', code => {
      fs.unlink(tempFilePath, () => {}); // Clean up temp file
      if (code !== 0 || error) {
        return res.status(500).json({ error: error || 'Prediction failed' });
      }
      try {
        const json = JSON.parse(result);
        res.json(json);
      } catch (e) {
        res.status(200).send(result); // Fallback: send raw output
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to predict image' });
  }
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
