// Simple Express server to fetch the latest image from a Google Cloud Storage bucket
require('dotenv').config();
const express = require('express');
const { Storage } = require('@google-cloud/storage');
const cors = require('cors');

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

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
